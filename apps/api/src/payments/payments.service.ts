import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AllocatableType,
  Payment,
  PaymentAllocation,
  PaymentStatus,
  Prisma,
  RentScheduleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
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

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly cashProvider: CashProvider,
    private readonly mobileMoneyProvider: MobileMoneyProvider,
  ) {}

  /**
   * Create a payment record idempotently. If a payment with the same
   * `idempotencyKey` already exists, return it without creating a new row.
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<PublicPayment> {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { allocations: true },
    });
    if (existing) return this.toPublic(existing);

    const session =
      input.method === 'CASH'
        ? await this.cashProvider.initiate(input)
        : await this.mobileMoneyProvider.initiate({
            ...input,
            provider: input.provider ?? 'AIRTEL',
            phone: input.phone ?? '',
          });

    const created = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        method: input.method,
        ...(input.provider ? { provider: input.provider } : {}),
        status: session.status,
        reference: session.reference,
        idempotencyKey: input.idempotencyKey,
        ...(input.metadata
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
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

    const updated = await this.prisma.$transaction(async (tx) => {
      await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: PaymentStatus.VALIDATED,
          validatedBy: agentUserId,
          validatedAt: new Date(),
        },
      });
      if (allocations.length > 0) {
        await tx.paymentAllocation.createMany({
          data: allocations.map((a) => ({
            paymentId,
            type: a.type,
            refId: a.refId,
            amount: new Prisma.Decimal(a.amount),
            ...(a.rentScheduleId ? { rentScheduleId: a.rentScheduleId } : {}),
          })),
        });
        // If a rent schedule is fully covered, flip it to PAID.
        const rentScheduleIds = allocations
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
