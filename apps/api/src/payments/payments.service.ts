import {
  BadRequestException,
  ForbiddenException,
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
import { AgencyAccessService } from '../mandates/agency-access.service';
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
  rentScheduleId?: string;
  saleInstallmentId?: string;
  visitBookingId?: string;
  metadata?: Record<string, unknown>;
}

export interface RecordCashPaymentInput {
  /** Exactly one of rentScheduleId / saleInstallmentId is required. */
  rentScheduleId?: string;
  saleInstallmentId?: string;
  idempotencyKey: string;
  amount?: string | number;
  currency?: string;
  note?: string;
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

type PaymentMetadata = {
  baseAmountXaf?: number;
  [key: string]: unknown;
};

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
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

    if (input.saleInstallmentId) {
      const installment = await this.prisma.saleInstallment.findUnique({
        where: { id: input.saleInstallmentId },
        include: {
          agreement: { select: { buyerId: true, status: true } },
        },
      });
      if (!installment) {
        throw new NotFoundException({
          code: 'SALE_INSTALLMENT_NOT_FOUND',
          message: 'Sale installment does not exist',
        });
      }
      if (installment.agreement.buyerId !== input.userId) {
        throw new ForbiddenException({
          code: 'NOT_SALE_BUYER',
          message: 'Only the buyer can pay this installment',
        });
      }
      if (installment.agreement.status !== 'ACTIVE') {
        throw new BadRequestException({
          code: 'SALE_AGREEMENT_NOT_ACTIVE',
          message: 'Sale agreement is not active',
        });
      }
      if (installment.status === 'PAID') {
        throw new BadRequestException({
          code: 'SALE_INSTALLMENT_ALREADY_PAID',
          message: 'This installment is already paid',
        });
      }
    }

    const amount = Number(input.amount);
    const metadata: PaymentMetadata = {
      ...(input.metadata ?? {}),
      ...(input.rentScheduleId
        ? { rentScheduleId: input.rentScheduleId }
        : {}),
      ...(input.saleInstallmentId
        ? { saleInstallmentId: input.saleInstallmentId }
        : {}),
      ...(input.visitBookingId
        ? { visitBookingId: input.visitBookingId }
        : {}),
    };

    const session =
      input.method === 'CASH'
        ? await this.cashProvider.initiate({ ...input, amount })
        : await this.mobileMoneyProvider.initiate({
            ...input,
            amount,
            provider: input.provider ?? 'AIRTEL',
            phone: input.phone ?? '',
          });

    const created = await this.prisma.payment.create({
      data: {
        userId: input.userId,
        amount: new Prisma.Decimal(amount),
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
   * Agent/owner records cash received in person: create CASH payment for the
   * lease tenant or sale buyer and validate+allocate in one transaction.
   */
  async recordCashPayment(
    agentUserId: string,
    input: RecordCashPaymentInput,
  ): Promise<PublicPayment> {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { allocations: true },
    });
    if (existing) return this.toPublic(existing);

    const hasRent = Boolean(input.rentScheduleId);
    const hasSale = Boolean(input.saleInstallmentId);
    if (hasRent === hasSale) {
      throw new BadRequestException({
        code: 'RECORD_CASH_TARGET_REQUIRED',
        message: 'Provide exactly one of rentScheduleId or saleInstallmentId',
      });
    }

    if (input.saleInstallmentId) {
      return this.recordCashForSaleInstallment(agentUserId, {
        ...input,
        saleInstallmentId: input.saleInstallmentId,
      });
    }

    return this.recordCashForRentSchedule(agentUserId, {
      ...input,
      rentScheduleId: input.rentScheduleId as string,
    });
  }

  private async recordCashForRentSchedule(
    agentUserId: string,
    input: RecordCashPaymentInput & { rentScheduleId: string },
  ): Promise<PublicPayment> {
    const schedule = await this.prisma.rentSchedule.findUnique({
      where: { id: input.rentScheduleId },
      include: {
        lease: {
          select: {
            id: true,
            tenantId: true,
            status: true,
            property: {
              select: { id: true, ownerId: true, organizationId: true },
            },
          },
        },
      },
    });
    if (!schedule) {
      throw new NotFoundException({
        code: 'RENT_SCHEDULE_NOT_FOUND',
        message: 'Rent schedule does not exist',
      });
    }
    if (schedule.status === RentScheduleStatus.PAID) {
      throw new BadRequestException({
        code: 'RENT_SCHEDULE_ALREADY_PAID',
        message: 'This rent schedule is already paid',
      });
    }
    if (schedule.lease.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'LEASE_NOT_ACTIVE',
        message: 'Cash can only be recorded on an active lease',
      });
    }

    await this.agencyAccess.assertCanOperateOnProperty(
      agentUserId,
      schedule.lease.property.id,
    );

    const amount = Number(input.amount ?? schedule.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a positive number',
      });
    }
    const currency = input.currency ?? schedule.currency;
    const session = await this.cashProvider.initiate({
      userId: schedule.lease.tenantId,
      amount,
      currency,
      idempotencyKey: input.idempotencyKey,
    });

    const metadata: PaymentMetadata = {
      rentScheduleId: schedule.id,
      recordedByAgent: true,
      ...(input.note ? { note: input.note } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId: schedule.lease.tenantId,
          amount: new Prisma.Decimal(amount),
          currency,
          method: 'CASH',
          status: PaymentStatus.VALIDATED,
          reference: session.reference,
          idempotencyKey: input.idempotencyKey,
          validatedBy: agentUserId,
          validatedAt: new Date(),
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      await tx.paymentAllocation.create({
        data: {
          paymentId: created.id,
          type: AllocatableType.RENT_SCHEDULE,
          refId: schedule.id,
          amount: new Prisma.Decimal(amount),
          rentScheduleId: schedule.id,
        },
      });
      await this.maybeMarkRentSchedulePaid(tx, schedule.id);
      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
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

  private async recordCashForSaleInstallment(
    agentUserId: string,
    input: RecordCashPaymentInput & { saleInstallmentId: string },
  ): Promise<PublicPayment> {
    const installment = await this.prisma.saleInstallment.findUnique({
      where: { id: input.saleInstallmentId },
      include: {
        agreement: {
          select: {
            id: true,
            buyerId: true,
            status: true,
            property: {
              select: { id: true, ownerId: true, organizationId: true },
            },
          },
        },
      },
    });
    if (!installment) {
      throw new NotFoundException({
        code: 'SALE_INSTALLMENT_NOT_FOUND',
        message: 'Sale installment does not exist',
      });
    }
    if (installment.status === 'PAID') {
      throw new BadRequestException({
        code: 'SALE_INSTALLMENT_ALREADY_PAID',
        message: 'This installment is already paid',
      });
    }
    if (installment.agreement.status !== 'ACTIVE') {
      throw new BadRequestException({
        code: 'SALE_AGREEMENT_NOT_ACTIVE',
        message: 'Cash can only be recorded on an active sale agreement',
      });
    }

    await this.agencyAccess.assertCanOperateOnProperty(
      agentUserId,
      installment.agreement.property.id,
    );

    const amount = Number(input.amount ?? installment.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a positive number',
      });
    }
    const currency = input.currency ?? installment.currency;
    const buyerId = installment.agreement.buyerId;
    const session = await this.cashProvider.initiate({
      userId: buyerId,
      amount,
      currency,
      idempotencyKey: input.idempotencyKey,
    });

    const metadata: PaymentMetadata = {
      saleInstallmentId: installment.id,
      recordedByAgent: true,
      ...(input.note ? { note: input.note } : {}),
    };

    const updated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId: buyerId,
          amount: new Prisma.Decimal(amount),
          currency,
          method: 'CASH',
          status: PaymentStatus.VALIDATED,
          reference: session.reference,
          idempotencyKey: input.idempotencyKey,
          validatedBy: agentUserId,
          validatedAt: new Date(),
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      await tx.paymentAllocation.create({
        data: {
          paymentId: created.id,
          type: AllocatableType.SALE_INSTALLMENT,
          refId: installment.id,
          amount: new Prisma.Decimal(amount),
        },
      });
      await this.maybeMarkSaleInstallmentPaid(tx, installment.id);
      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
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

    const meta = (payment.metadata ?? {}) as PaymentMetadata;

    const finalAllocations: PaymentAllocationInput[] = [...allocations];
    const hasRentAlloc = finalAllocations.some(
      (a) => a.type === 'RENT_SCHEDULE' && a.rentScheduleId,
    );
    const hasSaleAlloc = finalAllocations.some(
      (a) => a.type === 'SALE_INSTALLMENT',
    );
    const metaSaleId =
      typeof meta.saleInstallmentId === 'string'
        ? meta.saleInstallmentId
        : null;

    if (!hasRentAlloc && !hasSaleAlloc) {
      const scheduleId =
        typeof meta.rentScheduleId === 'string' ? meta.rentScheduleId : null;
      if (metaSaleId) {
        finalAllocations.push({
          type: AllocatableType.SALE_INSTALLMENT,
          refId: metaSaleId,
          amount: Number(payment.amount),
        });
      } else if (scheduleId) {
        finalAllocations.push({
          type: AllocatableType.RENT_SCHEDULE,
          refId: scheduleId,
          rentScheduleId: scheduleId,
          amount: Number(payment.amount),
        });
      } else {
        throw new BadRequestException({
          code: 'PAYMENT_ALLOCATION_REQUIRED',
          message:
            'Rent schedule or sale installment allocation is required (body or payment metadata)',
        });
      }
    }

    const firstRentAlloc = finalAllocations.find(
      (a) => a.type === 'RENT_SCHEDULE' && a.rentScheduleId,
    );
    const firstSaleAlloc = finalAllocations.find(
      (a) => a.type === 'SALE_INSTALLMENT',
    );
    let property: {
      id: string;
      ownerId: string;
      organizationId: string;
    } | null = null;
    if (firstRentAlloc?.rentScheduleId) {
      const sched = await this.prisma.rentSchedule.findUnique({
        where: { id: firstRentAlloc.rentScheduleId },
        include: {
          lease: {
            select: {
              property: {
                select: { id: true, ownerId: true, organizationId: true },
              },
            },
          },
        },
      });
      property = sched?.lease?.property ?? null;
    } else if (firstSaleAlloc) {
      const installment = await this.prisma.saleInstallment.findUnique({
        where: { id: firstSaleAlloc.refId },
        include: {
          agreement: {
            select: {
              property: {
                select: { id: true, ownerId: true, organizationId: true },
              },
            },
          },
        },
      });
      property = installment?.agreement?.property ?? null;
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
      await this.agencyAccess.assertCanOperateOnProperty(
        agentUserId,
        property.id,
      );
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
        const saleInstallmentIds = finalAllocations
          .filter((a) => a.type === 'SALE_INSTALLMENT')
          .map((a) => a.refId);
        for (const installmentId of saleInstallmentIds) {
          await this.maybeMarkSaleInstallmentPaid(tx, installmentId);
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

  /**
   * Cash payments awaiting manual validation on the caller's operable
   * portfolio (owner / gérant / assigned agent).
   */
  async listPendingValidation(userId: string): Promise<PublicPayment[]> {
    const managed = await this.listManaged(userId);
    return managed.filter(
      (p) => p.method === 'CASH' && p.status === 'PENDING_VALIDATION',
    );
  }

  /**
   * Payments on properties the user can operate on (owner, gérant, or
   * assigned agent). Union of allocated payments and pending cash linked to
   * the portfolio (metadata.rentScheduleId or payer ACTIVE lease).
   */
  async listManaged(userId: string): Promise<PublicPayment[]> {
    const propertyIds = await this.accessiblePropertyIds(userId);
    if (propertyIds.length === 0) return [];

    const leases = await this.prisma.lease.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true, tenantId: true, status: true },
    });
    const leaseIds = leases.map((l) => l.id);
    const activeTenantIds = [
      ...new Set(
        leases
          .filter((l) => l.status === 'ACTIVE')
          .map((l) => l.tenantId),
      ),
    ];

    const schedules =
      leaseIds.length === 0
        ? []
        : await this.prisma.rentSchedule.findMany({
            where: { leaseId: { in: leaseIds } },
            select: { id: true },
          });
    const scheduleIds = schedules.map((s) => s.id);
    const scheduleIdSet = new Set(scheduleIds);
    const tenantIdSet = new Set(activeTenantIds);

    const allocatedIds =
      scheduleIds.length === 0
        ? []
        : (
            await this.prisma.paymentAllocation.findMany({
              where: { rentScheduleId: { in: scheduleIds } },
              select: { paymentId: true },
              distinct: ['paymentId'],
              take: 500,
            })
          ).map((a) => a.paymentId);

    const pendingRows = await this.prisma.payment.findMany({
      where: {
        method: 'CASH',
        status: PaymentStatus.PENDING_VALIDATION,
      },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });
    const pendingIds = pendingRows
      .filter((p) => {
        const meta = (p.metadata ?? {}) as PaymentMetadata;
        if (
          typeof meta.rentScheduleId === 'string' &&
          scheduleIdSet.has(meta.rentScheduleId)
        ) {
          return true;
        }
        return tenantIdSet.has(p.userId);
      })
      .map((p) => p.id);

    const paymentIds = Array.from(new Set([...allocatedIds, ...pendingIds]));
    if (paymentIds.length === 0) return [];

    const rows = await this.prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((p) => this.toPublic(p));
  }

  async getOne(userId: string, paymentId: string): Promise<PublicPayment> {
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
    await this.assertCanReadPayment(userId, payment);
    return this.toPublic(payment);
  }

  private async accessiblePropertyIds(userId: string): Promise<string[]> {
    return this.agencyAccess.listOperablePropertyIds(userId);
  }

  private async assertCanReadPayment(
    userId: string,
    payment: Payment & { allocations: PaymentAllocation[] },
  ): Promise<void> {
    if (payment.userId === userId) return;

    const meta = (payment.metadata ?? {}) as PaymentMetadata;
    const scheduleIds = new Set<string>();
    for (const a of payment.allocations) {
      if (a.rentScheduleId) scheduleIds.add(a.rentScheduleId);
    }
    if (typeof meta.rentScheduleId === 'string') {
      scheduleIds.add(meta.rentScheduleId);
    }

    const propertyIds = await this.accessiblePropertyIds(userId);
    if (propertyIds.length === 0) {
      throw new ForbiddenException({
        code: 'PAYMENT_FORBIDDEN',
        message: 'You are not authorized to read this payment',
      });
    }

    if (scheduleIds.size > 0) {
      const hit = await this.prisma.rentSchedule.findFirst({
        where: {
          id: { in: [...scheduleIds] },
          lease: { propertyId: { in: propertyIds } },
        },
        select: { id: true },
      });
      if (hit) return;
    }

    const activeLease = await this.prisma.lease.findFirst({
      where: {
        tenantId: payment.userId,
        status: 'ACTIVE',
        propertyId: { in: propertyIds },
      },
      select: { id: true },
    });
    if (activeLease) return;

    throw new ForbiddenException({
      code: 'PAYMENT_FORBIDDEN',
      message: 'You are not authorized to read this payment',
    });
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

  private async maybeMarkSaleInstallmentPaid(
    tx: Prisma.TransactionClient,
    installmentId: string,
  ): Promise<void> {
    const installment = await tx.saleInstallment.findUnique({
      where: { id: installmentId },
    });
    if (!installment) return;
    const totalAllocated = await tx.paymentAllocation.aggregate({
      where: { type: 'SALE_INSTALLMENT', refId: installmentId },
      _sum: { amount: true },
    });
    const allocated = totalAllocated._sum.amount ?? new Prisma.Decimal(0);
    if (allocated.gte(installment.amount)) {
      await tx.saleInstallment.update({
        where: { id: installmentId },
        data: { status: 'PAID' },
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
