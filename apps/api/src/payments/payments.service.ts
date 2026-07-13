import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AllocatableType,
  MessagePayerType,
  Payment,
  PaymentAllocation,
  PaymentStatus,
  Prisma,
  RentScheduleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { MessagingBillingService } from '../messaging/messaging-billing.service';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';

export interface InitiatePaymentInput {
  userId: string;
  amount: string | number;
  currency: string;
  method: 'CASH' | 'MOBILE_MONEY';
  provider?: 'AIRTEL' | 'MOMO';
  phone?: string;
  idempotencyKey: string;
  rentScheduleId?: string;
  metadata?: Record<string, unknown>;
}

export interface PaymentAllocationInput {
  type: AllocatableType;
  refId: string;
  amount: string | number;
  rentScheduleId?: string;
}

export interface PublicPayment {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  method: string;
  provider: string | null;
  status: string;
  reference: string;
  idempotencyKey: string;
  validatedBy: string | null;
  validatedAt: string | null;
  messagingDebtXaf: number;
  allocations: PublicAllocation[];
  createdAt: string;
}

export interface PublicAllocation {
  id: string;
  type: string;
  refId: string;
  amount: string;
  rentScheduleId: string | null;
}

type PaymentMetadata = {
  messagingDebtXaf?: number;
  messagingChargeIds?: string[];
  baseAmountXaf?: number;
  [key: string]: unknown;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly cashProvider: CashProvider,
    private readonly mobileMoneyProvider: MobileMoneyProvider,
    private readonly messaging: MessagingBillingService,
  ) {}

  /**
   * Create a payment record idempotently. If a payment with the same
   * `idempotencyKey` already exists, return it without creating a new row.
   * Open user messaging debt is added to the charged amount.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<PublicPayment> {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { allocations: true },
    });
    if (existing) return this.toPublic(existing);

    if (input.rentScheduleId) {
      const schedule = await this.prisma.rentSchedule.findUnique({
        where: { id: input.rentScheduleId },
        select: { id: true },
      });
      if (!schedule) {
        throw new NotFoundException({
          code: 'RENT_SCHEDULE_NOT_FOUND',
          message: 'Rent schedule does not exist',
        });
      }
    }

    const debt = await this.messaging.openBalanceXaf(
      MessagePayerType.USER,
      input.userId,
    );
    const open =
      debt > 0
        ? await this.messaging.listOpenCharges(
            MessagePayerType.USER,
            input.userId,
          )
        : [];
    const base = Number(input.amount);
    const total = base + debt;
    const metadata: PaymentMetadata = {
      ...(input.metadata ?? {}),
      ...(input.rentScheduleId
        ? { rentScheduleId: input.rentScheduleId }
        : {}),
      ...(debt > 0
        ? {
            messagingDebtXaf: debt,
            messagingChargeIds: open.map((c) => c.id),
            baseAmountXaf: base,
          }
        : {}),
    };

    const session =
      input.method === 'CASH'
        ? await this.cashProvider.initiate({ ...input, amount: total })
        : await this.mobileMoneyProvider.initiate({
            ...input,
            amount: total,
            provider: input.provider ?? 'AIRTEL',
            phone: input.phone ?? '',
          });

    const created = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        amount: new Prisma.Decimal(total),
        currency: input.currency,
        method: input.method,
        ...(input.provider ? { provider: input.provider } : {}),
        status: session.status,
        reference: session.reference,
        idempotencyKey: input.idempotencyKey,
        metadata: metadata as Prisma.InputJsonValue,
      },
      include: { allocations: true },
    });
    return this.toPublic(created);
  }

  /**
   * Cash payments require manual validation by an agent/owner. This flips
   * the status to `VALIDATED`, creates `PaymentAllocation`s, and updates the
   * linked `RentSchedule` rows to `PAID` (only when fully allocated).
   */
  async validateCashPayment(
    agentUserId: string,
    paymentId: string,
    allocations: PaymentAllocationInput[],
  ): Promise<PublicPayment> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: 'Payment does not exist',
      });
    }
    if (payment.method !== 'CASH') {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_CASH',
        message: 'Only cash payments go through manual validation',
      });
    }
    if (payment.status === PaymentStatus.VALIDATED) {
      return this.toPublic(payment);
    }
    if (payment.status !== PaymentStatus.PENDING_VALIDATION) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_VALIDATABLE',
        message: `Payment in status ${payment.status} cannot be validated`,
      });
    }

    const firstAlloc = allocations.find(
      (a) => a.type === 'RENT_SCHEDULE' && a.rentScheduleId,
    );
    let property: { ownerId: string; organizationId: string } | null = null;
    if (firstAlloc?.rentScheduleId) {
      const sched = await this.prisma.rentSchedule.findUnique({
        where: { id: firstAlloc.rentScheduleId },
        include: {
          lease: {
            select: {
              property: {
                select: { ownerId: true, organizationId: true },
              },
            },
          },
        },
      });
      property = sched?.lease?.property ?? null;
    }
    if (!property) {
      const user = await this.prisma.user.findUnique({
        where: { id: agentUserId },
        include: { roles: true },
      });
      const isAdmin =
        user?.roles.some((r) => r.role === 'PLATFORM_ADMIN') ?? false;
      if (!isAdmin) {
        throw new ForbiddenException({
          code: 'NOT_VALIDATION_AGENT',
          message:
            'Only the property owner, an agent of the managing org, or a platform admin can validate this payment',
        });
      }
    } else {
      const isOwner = property.ownerId === agentUserId;
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId: agentUserId,
            organizationId: property.organizationId,
          },
        },
      });
      if (!isOwner && !membership) {
        throw new ForbiddenException({
          code: 'NOT_VALIDATION_AGENT',
          message:
            'Only the property owner or an agent of the managing org can validate this payment',
        });
      }
    }

    const meta = (payment.metadata ?? {}) as PaymentMetadata;
    const messagingDebt = Number(meta.messagingDebtXaf ?? 0);
    const messagingChargeIds = Array.isArray(meta.messagingChargeIds)
      ? meta.messagingChargeIds
      : [];

    const finalAllocations: PaymentAllocationInput[] = [...allocations];
    if (
      messagingDebt > 0 &&
      !finalAllocations.some((a) => a.type === AllocatableType.MESSAGING_DEBT)
    ) {
      finalAllocations.push({
        type: AllocatableType.MESSAGING_DEBT,
        refId: payment.userId,
        amount: messagingDebt,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.VALIDATED,
          validatedBy: agentUserId,
          validatedAt: new Date(),
        },
      });
      if (finalAllocations.length > 0) {
        await tx.paymentAllocation.createMany({
          data: finalAllocations.map((a) => ({
            paymentId,
            type: a.type,
            refId: a.refId,
            amount: new Prisma.Decimal(a.amount),
            ...(a.rentScheduleId ? { rentScheduleId: a.rentScheduleId } : {}),
          })),
        });
        // If a rent schedule is fully covered, flip it to PAID.
        const rentScheduleIds = finalAllocations
          .filter((a) => a.type === 'RENT_SCHEDULE' && a.rentScheduleId)
          .map((a) => a.rentScheduleId as string);
        for (const scheduleId of rentScheduleIds) {
          await this.maybeMarkRentSchedulePaid(tx, scheduleId);
        }
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: paymentId },
        include: { allocations: true },
      });
    });

    await this.messaging.settleCharges(updated.id, messagingChargeIds);

    await this.events.emit(DOMAIN_EVENTS.PAYMENT_VALIDATED, {
      paymentId: updated.id,
      userId: updated.userId,
      amount: updated.amount.toString(),
      currency: updated.currency,
    });

    return this.toPublic(updated);
  }

  /**
   * Webhook entry point for mobile money providers. Verifies HMAC signature,
   * parses the payload, and updates the matching payment.
   */
  async handleMobileMoneyWebhook(
    rawPayload: string,
    signature: string,
  ): Promise<PublicPayment> {
    const result = await this.mobileMoneyProvider.handleWebhook(
      rawPayload,
      signature,
    );
    if (!result.reference) {
      throw new BadRequestException({
        code: 'WEBHOOK_REFERENCE_MISSING',
        message: 'No payment reference in webhook',
      });
    }
    const payment = await this.prisma.payment.findUnique({
      where: { reference: result.reference },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: `No payment with reference ${result.reference}`,
      });
    }
    const newStatus =
      result.status === PaymentStatus.VALIDATED
        ? PaymentStatus.VALIDATED
        : PaymentStatus.FAILED;
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status: newStatus,
        ...(newStatus === PaymentStatus.VALIDATED
          ? { validatedAt: new Date() }
          : {}),
      },
      include: { allocations: true },
    });
    if (newStatus === PaymentStatus.VALIDATED) {
      const meta = (updated.metadata ?? {}) as PaymentMetadata;
      const chargeIds = Array.isArray(meta.messagingChargeIds)
        ? meta.messagingChargeIds
        : [];
      await this.messaging.settleCharges(updated.id, chargeIds);
      await this.events.emit(DOMAIN_EVENTS.PAYMENT_VALIDATED, {
        paymentId: updated.id,
        userId: updated.userId,
        amount: updated.amount.toString(),
        currency: updated.currency,
      });
    }
    return this.toPublic(updated);
  }

  async listMyPayments(userId: string): Promise<PublicPayment[]> {
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => this.toPublic(p));
  }

  /**
   * Cash payments awaiting manual validation — shown in the agent
   * validation queue (Task 26).
   */
  async listPendingValidation(): Promise<PublicPayment[]> {
    const rows = await this.prisma.payment.findMany({
      where: {
        method: 'CASH',
        status: PaymentStatus.PENDING_VALIDATION,
      },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((p) => this.toPublic(p));
  }

  /**
   * Payments on properties the user owns or manages (via an organization
   * membership). Walks the chain properties → leases → rent schedules →
   * payment allocations → payments.
   */
  async listManaged(userId: string): Promise<PublicPayment[]> {
    const accessible = await this.prisma.property.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            organization: {
              members: { some: { userId } },
            },
          },
        ],
      },
      select: { id: true },
      take: 500,
    });
    const propertyIds = accessible.map((p) => p.id);
    if (propertyIds.length === 0) return [];

    const leases = await this.prisma.lease.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true },
    });
    const leaseIds = leases.map((l) => l.id);
    if (leaseIds.length === 0) return [];

    const schedules = await this.prisma.rentSchedule.findMany({
      where: { leaseId: { in: leaseIds } },
      select: { id: true },
    });
    const scheduleIds = schedules.map((s) => s.id);
    if (scheduleIds.length === 0) return [];

    const allocations = await this.prisma.paymentAllocation.findMany({
      where: { rentScheduleId: { in: scheduleIds } },
      select: { paymentId: true },
      distinct: ['paymentId'],
      take: 500,
    });
    const paymentIds = Array.from(new Set(allocations.map((a) => a.paymentId)));
    if (paymentIds.length === 0) return [];

    const rows = await this.prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((p) => this.toPublic(p));
  }

  private async maybeMarkRentSchedulePaid(
    tx: Prisma.TransactionClient,
    scheduleId: string,
  ): Promise<void> {
    const schedule = await tx.rentSchedule.findUnique({
      where: { id: scheduleId },
      include: { lease: { select: { id: true } } },
    });
    if (!schedule) return;
    const totalAllocated = await tx.paymentAllocation.aggregate({
      where: { rentScheduleId: scheduleId },
      _sum: { amount: true },
    });
    const allocated = totalAllocated._sum.amount ?? new Prisma.Decimal(0);
    if (allocated.gte(schedule.amount)) {
      await tx.rentSchedule.update({
        where: { id: scheduleId },
        data: { status: RentScheduleStatus.PAID },
      });
    }
  }

  private toPublic(
    p: Payment & { allocations: PaymentAllocation[] },
  ): PublicPayment {
    const meta = (p.metadata ?? {}) as PaymentMetadata;
    return {
      id: p.id,
      userId: p.userId,
      amount: p.amount.toString(),
      currency: p.currency,
      method: p.method,
      provider: p.provider,
      status: p.status,
      reference: p.reference,
      idempotencyKey: p.idempotencyKey,
      validatedBy: p.validatedBy,
      validatedAt: p.validatedAt?.toISOString() ?? null,
      messagingDebtXaf: Number(meta.messagingDebtXaf ?? 0),
      allocations: p.allocations.map((a) => ({
        id: a.id,
        type: a.type,
        refId: a.refId,
        amount: a.amount.toString(),
        rentScheduleId: a.rentScheduleId,
      })),
      createdAt: p.createdAt.toISOString(),
    };
  }
}
