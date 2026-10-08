import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Expense, ExpenseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { R2Service } from '../media/r2.service';

export interface CreateExpenseInput {
  propertyId: string;
  category: string;
  label: string;
  amount: number;
  currency?: string;
  incurredAt?: Date;
  mandateId?: string;
  /** Keep as DRAFT instead of submitting right away. */
  draft?: boolean;
}

export interface UpdateExpenseInput {
  category?: string;
  label?: string;
  amount?: number;
  incurredAt?: Date;
  submit?: boolean;
}

export interface PublicExpense {
  id: string;
  propertyId: string;
  mandateId: string | null;
  ticketId: string | null;
  category: string;
  label: string;
  amount: string;
  currency: string;
  invoiceKey: string | null;
  status: string;
  createdById: string;
  incurredAt: string;
  createdAt: string;
}

@Injectable()
export class ExpensesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly approvals: MandateApprovalService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly r2: R2Service,
  ) {}

  /**
   * Spec 03 US 14 — an agency records an expense on a property (invoice
   * attached). Unless kept DRAFT, the expense is submitted: above the
   * mandate's `repairApprovalThreshold` it becomes PENDING_APPROVAL and an
   * EXPENSE approval is requested; below it (or with no mandate) it is
   * APPROVED immediately and hits the ledger.
   */
  async createExpense(
    userId: string,
    input: CreateExpenseInput,
    file?: { buffer: Buffer; filename: string; mimetype: string },
  ): Promise<PublicExpense> {
    await this.agencyAccess.assertCanOperateOnProperty(
      userId,
      input.propertyId,
    );
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (!(input.amount > 0)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Expense amount must be positive',
      });
    }

    let invoiceKey: string | undefined;
    if (file) {
      const uploaded = await this.r2.uploadPrivateFile({
        folder: 'expenses',
        ownerId: userId,
        filename: file.filename,
        contentType: file.mimetype,
        body: file.buffer,
      });
      invoiceKey = uploaded.key;
    }

    const mandate =
      (input.mandateId
        ? await this.prisma.mandate.findFirst({
            where: {
              id: input.mandateId,
              propertyId: input.propertyId,
              OR: [
                { status: 'ACTIVE' },
                {
                  status: 'TERMINATING',
                  terminationEffectiveAt: { gt: new Date() },
                },
              ],
            },
          })
        : null) ??
      (await this.prisma.mandate.findFirst({
        where: {
          propertyId: input.propertyId,
          OR: [
            { status: 'ACTIVE' },
            { status: 'TERMINATING', terminationEffectiveAt: { gt: new Date() } },
          ],
        },
      }));

    const expense = await this.prisma.expense.create({
      data: {
        propertyId: input.propertyId,
        mandateId: mandate?.id ?? null,
        category: input.category,
        label: input.label,
        amount: input.amount,
        currency: input.currency ?? 'XAF',
        ...(invoiceKey ? { invoiceKey } : {}),
        status: ExpenseStatus.DRAFT,
        createdById: userId,
        incurredAt: input.incurredAt ?? new Date(),
      },
    });

    if (input.draft === true) return this.toPublic(expense);
    return this.submitExpense(userId, expense.id);
  }

  /** Submit a DRAFT (or REJECTED) expense: threshold decides the path. */
  async submitExpense(
    userId: string,
    expenseId: string,
  ): Promise<PublicExpense> {
    const expense = await this.requireOwnedExpense(userId, expenseId);
    if (
      expense.status !== ExpenseStatus.DRAFT &&
      expense.status !== ExpenseStatus.REJECTED
    ) {
      throw new BadRequestException({
        code: 'EXPENSE_NOT_EDITABLE',
        message: 'Only a DRAFT or REJECTED expense can be submitted',
      });
    }

    const mandate = expense.mandateId
      ? await this.prisma.mandate.findUnique({
          where: { id: expense.mandateId },
          select: { id: true, repairApprovalThreshold: true },
        })
      : null;
    const threshold = mandate?.repairApprovalThreshold ?? null;
    const needsApproval =
      mandate !== null &&
      threshold !== null &&
      new Prisma.Decimal(expense.amount).gt(threshold);

    if (needsApproval && mandate) {
      const updated = await this.prisma.expense.update({
        where: { id: expenseId },
        data: { status: ExpenseStatus.PENDING_APPROVAL },
      });
      await this.approvals.requireApproval({
        mandateId: mandate.id,
        actionType: 'EXPENSE',
        payload: {
          expenseId,
          amount: expense.amount.toString(),
          label: expense.label,
          category: expense.category,
        },
        requestedByUserId: userId,
        sourceType: 'EXPENSE',
        sourceId: expenseId,
      });
      return this.toPublic(updated);
    }

    const updated = await this.prisma.expense.update({
      where: { id: expenseId },
      data: { status: ExpenseStatus.APPROVED },
    });
    await this.events.emit(DOMAIN_EVENTS.EXPENSE_APPROVED, { expenseId });
    return this.toPublic(updated);
  }

  async updateExpense(
    userId: string,
    expenseId: string,
    input: UpdateExpenseInput,
  ): Promise<PublicExpense> {
    const expense = await this.requireOwnedExpense(userId, expenseId);
    if (
      expense.status !== ExpenseStatus.DRAFT &&
      expense.status !== ExpenseStatus.REJECTED
    ) {
      throw new BadRequestException({
        code: 'EXPENSE_NOT_EDITABLE',
        message: 'Only a DRAFT or REJECTED expense can be modified',
      });
    }
    if (input.amount !== undefined && !(input.amount > 0)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Expense amount must be positive',
      });
    }
    await this.prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.amount !== undefined ? { amount: input.amount } : {}),
        ...(input.incurredAt !== undefined
          ? { incurredAt: input.incurredAt }
          : {}),
      },
    });
    if (input.submit === true) return this.submitExpense(userId, expenseId);
    const fresh = await this.prisma.expense.findUniqueOrThrow({
      where: { id: expenseId },
    });
    return this.toPublic(fresh);
  }

  /** List expenses for a property — any party that can operate on it. */
  async listForProperty(
    userId: string,
    propertyId: string,
    status?: ExpenseStatus,
  ): Promise<PublicExpense[]> {
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
    const rows = await this.prisma.expense.findMany({
      where: {
        propertyId,
        ...(status ? { status } : {}),
      },
      orderBy: { incurredAt: 'desc' },
    });
    return rows.map((e) => this.toPublic(e));
  }

  private async requireOwnedExpense(
    userId: string,
    expenseId: string,
  ): Promise<Expense> {
    const expense = await this.prisma.expense.findUnique({
      where: { id: expenseId },
    });
    if (!expense) {
      throw new NotFoundException({
        code: 'EXPENSE_NOT_FOUND',
        message: 'Expense does not exist',
      });
    }
    if (expense.createdById !== userId) {
      throw new ForbiddenException({
        code: 'NOT_EXPENSE_CREATOR',
        message: 'Only the expense creator can modify or submit it',
      });
    }
    return expense;
  }

  private toPublic(e: Expense): PublicExpense {
    return {
      id: e.id,
      propertyId: e.propertyId,
      mandateId: e.mandateId,
      ticketId: e.ticketId,
      category: e.category,
      label: e.label,
      amount: e.amount.toString(),
      currency: e.currency,
      invoiceKey: e.invoiceKey,
      status: e.status,
      createdById: e.createdById,
      incurredAt: e.incurredAt.toISOString(),
      createdAt: e.createdAt.toISOString(),
    };
  }
}
