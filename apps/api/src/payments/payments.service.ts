import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  AllocatableType,
  Payment,
  PaymentAllocation,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  Refund,
  RentScheduleKind,
  RentScheduleStatus,
} from '@prisma/client';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { CashProvider } from './providers/cash.provider';
import { MobileMoneyProvider } from './providers/mobile-money.provider';
import type { ProviderOutcome } from './providers/payment-provider.interface';
import { RentReceiptService } from '../leases/rent-receipt.service';

/** Spec 05 — what a payment settles. */
export type PaymentTargetType =
  | 'RENT_SCHEDULE'
  | 'SALE_INSTALLMENT'
  | 'BOOKING'
  | 'VISIT_BOOKING';

export interface PaymentTargetInput {
  type: PaymentTargetType;
  id: string;
}

export interface InitiatePaymentInput {
  userId: string;
  /** Spec 05 — with a target the amount is computed server-side; an amount
   * differing from the balance due is only accepted for an allowed partial. */
  amount?: string | number;
  /** Ignored when a target is given (the target carries its currency). */
  currency?: string;
  method: 'CASH' | 'MOBILE_MONEY';
  provider?: 'AIRTEL' | 'MOMO';
  phone?: string;
  idempotencyKey: string;
  /** Legacy target shape (mobile client) — equivalent to `target`. */
  rentScheduleId?: string;
  saleInstallmentId?: string;
  visitBookingId?: string;
  /** Spec 05 — `{ type, id }` form accepted by `POST payments`. */
  target?: PaymentTargetInput;
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
  providerRef: string | null;
  idempotencyKey: string;
  validatedBy: string | null;
  validatedAt: string | null;
  /** Spec 05 — séjour ciblé, numéro débité, expiration, échec, remboursé. */
  bookingId: string | null;
  payerPhone: string | null;
  expiresAt: string | null;
  failureReason: string | null;
  refundedAmount: string;
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

/** Spec 05 — remboursement (total ou partiel) d'un paiement. */
export interface PublicRefund {
  id: string;
  paymentId: string;
  amount: string;
  reason: string;
  status: string;
  method: string;
  providerRef: string | null;
  requestedById: string;
  approvedById: string | null;
  proofKey: string | null;
  failureReason: string | null;
  createdAt: string;
  processedAt: string | null;
}

/** Spec 05 — contestation d'un paiement (débité mais non crédité, doublon). */
export interface PublicDispute {
  id: string;
  paymentId: string;
  openedById: string;
  reason: string;
  description: string;
  evidenceKeys: string[];
  status: string;
  resolution: string | null;
  resolvedById: string | null;
  createdAt: string;
  resolvedAt: string | null;
}

export interface CreateRefundInput {
  /** Defaults to the whole remaining amount. */
  amount?: number;
  reason: string;
  method: 'PROVIDER' | 'CASH';
  /** Required for a cash refund (proof of the hand-delivered money). */
  proofKey?: string;
}

export interface OpenDisputeInput {
  reason: 'NOT_CREDITED' | 'DUPLICATE' | 'WRONG_AMOUNT' | 'OTHER';
  description: string;
  evidenceKeys?: string[];
}

type PaymentMetadata = {
  baseAmountXaf?: number;
  [key: string]: unknown;
};

/** Spec 05 — un INITIATED sans confirmation expire après 15 minutes. */
const PAYMENT_TTL_MS = 15 * 60_000;

/** Spec 05 — a payment target once resolved server-side. */
interface ResolvedTarget {
  type: PaymentTargetType;
  id: string;
  /** Key of the target id inside `Payment.metadata` (uniqueness + retry). */
  metaKey: string;
  due: Prisma.Decimal;
  currency: string;
  meta: Record<string, unknown>;
  partial: { allowed: boolean; min: Prisma.Decimal | null };
}

/** Spec 05 — provider webhook / poll context, journalised in PaymentEvent. */
interface OutcomeContext {
  provider: string;
  kind: 'WEBHOOK' | 'STATUS_POLL';
  payload: Record<string, unknown>;
  signatureValid?: boolean;
  reason?: string;
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
    private readonly cashProvider: CashProvider,
    private readonly mobileMoneyProvider: MobileMoneyProvider,
    private readonly rentReceipts: RentReceiptService,
  ) {}

  /**
   * Spec 05 P0 — `POST payments` : la cible détermine le montant (calculé
   * côté serveur), le payeur autorisé et les règles de paiement partiel.
   *
   * Idempotence : même `idempotencyKey` → le paiement existant est renvoyé
   * tel quel, sauf s'il est terminé (FAILED / EXPIRED / CANCELLED) : la
   * ligne est alors réutilisée pour une nouvelle tentative (le mobile envoie
   * toujours la même clé pour une cible).
   */
  async initiatePayment(input: InitiatePaymentInput): Promise<PublicPayment> {
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      include: { allocations: true },
    });
    const retryable =
      existing !== null &&
      ['FAILED', 'EXPIRED', 'CANCELLED'].includes(existing.status);
    if (existing && !retryable) return this.toPublic(existing);

    const target = await this.resolveTarget(
      input.userId,
      this.rawTarget(input),
    );
    const amount = this.computeAmount(target, input);
    const currency = target?.currency ?? input.currency;
    if (!currency) {
      throw new BadRequestException({
        code: 'CURRENCY_REQUIRED',
        message: 'currency is required when no target is given',
      });
    }

    const metadata: PaymentMetadata = {
      ...(input.metadata ?? {}),
      ...(target?.meta ?? {}),
    };

    // Spec 05 — un seul paiement mobile money INITIATED par cible : la
    // nouvelle tentative annule la précédente.
    if (target && input.method === 'MOBILE_MONEY') {
      await this.prisma.payment.updateMany({
        where: {
          status: PaymentStatus.INITIATED,
          metadata: { path: [target.metaKey], equals: target.id },
        },
        data: {
          status: PaymentStatus.CANCELLED,
          failureReason: 'Superseded by a new attempt',
        },
      });
    }

    const now = new Date();
    const expiresAt =
      input.method === 'MOBILE_MONEY'
        ? new Date(now.getTime() + PAYMENT_TTL_MS)
        : null;
    const baseData = {
      amount,
      currency,
      method: input.method,
      provider: input.method === 'MOBILE_MONEY' ? (input.provider ?? 'AIRTEL') : null,
      status:
        input.method === 'CASH'
          ? PaymentStatus.PENDING_VALIDATION
          : PaymentStatus.INITIATED,
      payerPhone: input.phone ?? null,
      bookingId: target?.type === 'BOOKING' ? target.id : null,
      expiresAt,
      failureReason: null,
      validatedAt: null,
      validatedBy: null,
      metadata: metadata as Prisma.InputJsonValue,
    };

    let payment: Payment & { allocations: PaymentAllocation[] };
    if (existing && retryable) {
      payment = await this.prisma.payment.update({
        where: { id: existing.id },
        data: {
          ...baseData,
          reference: `pay-${randomUUID()}`,
          providerRef: null,
        },
        include: { allocations: true },
      });
    } else {
      const reference =
        input.method === 'CASH'
          ? (
              await this.cashProvider.initiate({
                userId: input.userId,
                amount: Number(amount),
                currency,
                idempotencyKey: input.idempotencyKey,
              })
            ).reference
          : `pay-${randomUUID()}`;
      payment = await this.prisma.payment.create({
        data: {
          userId: input.userId,
          reference,
          idempotencyKey: input.idempotencyKey,
          ...baseData,
          status: baseData.status as PaymentStatus,
        },
        include: { allocations: true },
      });
    }

    if (input.method === 'MOBILE_MONEY') {
      const provider = input.provider ?? 'AIRTEL';
      await this.logEvent(payment.id, provider, 'INITIATE_REQUEST', {
        amount: amount.toString(),
        currency,
        phone: input.phone ?? null,
        reference: payment.reference,
        target: target ? { type: target.type, id: target.id } : null,
      });
      try {
        const session = await this.mobileMoneyProvider.initiate({
          userId: input.userId,
          amount: Number(amount),
          currency,
          idempotencyKey: input.idempotencyKey,
          phone: input.phone ?? '',
          provider,
          reference: payment.reference,
          metadata,
        });
        payment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: {
            provider,
            providerRef: session.providerRef ?? payment.reference,
          },
          include: { allocations: true },
        });
        await this.logEvent(payment.id, provider, 'INITIATE_RESPONSE', {
          ok: true,
          providerRef: payment.providerRef,
        });
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err);
        payment = await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED, failureReason: reason },
          include: { allocations: true },
        });
        await this.logEvent(payment.id, provider, 'INITIATE_RESPONSE', {
          ok: false,
          error: reason,
        });
        await this.events.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
          paymentId: payment.id,
          userId: payment.userId,
          amount: payment.amount.toString(),
          currency: payment.currency,
          reason,
        });
        throw new BadRequestException({
          code: 'PAYMENT_PROVIDER_REJECTED',
          message: reason,
        });
      }
    }

    await this.events.emit(DOMAIN_EVENTS.PAYMENT_INITIATED, {
      paymentId: payment.id,
      userId: payment.userId,
      amount: payment.amount.toString(),
      currency: payment.currency,
    });
    return this.toPublic(payment);
  }

  /** Legacy flat fields or the new `{ type, id }` form → one target. */
  private rawTarget(
    input: InitiatePaymentInput,
  ): PaymentTargetInput | null {
    if (input.target) return input.target;
    if (input.rentScheduleId) {
      return { type: 'RENT_SCHEDULE', id: input.rentScheduleId };
    }
    if (input.saleInstallmentId) {
      return { type: 'SALE_INSTALLMENT', id: input.saleInstallmentId };
    }
    if (input.visitBookingId) {
      return { type: 'VISIT_BOOKING', id: input.visitBookingId };
    }
    return null;
  }

  /**
   * Spec 05 — résout la cible : montant dû (serveur), devise, payeur
   * autorisé, règles de partiel et métadonnées à stocker sur le paiement.
   */
  private async resolveTarget(
    userId: string,
    target: PaymentTargetInput | null,
  ): Promise<ResolvedTarget | null> {
    if (!target) return null;

    switch (target.type) {
      case 'RENT_SCHEDULE': {
        const schedule = await this.prisma.rentSchedule.findUnique({
          where: { id: target.id },
          include: {
            lease: {
              select: {
                tenantId: true,
                allowPartialPayments: true,
                minPartialAmount: true,
                coTenants: { select: { userId: true } },
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
        if (
          schedule.status === RentScheduleStatus.CANCELLED ||
          schedule.status === RentScheduleStatus.WAIVED
        ) {
          throw new BadRequestException({
            code: 'RENT_SCHEDULE_NOT_PAYABLE',
            message: `A ${schedule.status.toLowerCase()} schedule cannot be paid`,
          });
        }
        const isTenant = schedule.lease.tenantId === userId;
        const isCoTenant = schedule.lease.coTenants.some(
          (co) => co.userId === userId,
        );
        if (!isTenant && !isCoTenant) {
          throw new ForbiddenException({
            code: 'NOT_PAYER',
            message: 'Only the tenant or a co-tenant can pay this rent schedule',
          });
        }
        return {
          type: 'RENT_SCHEDULE',
          id: schedule.id,
          metaKey: 'rentScheduleId',
          due: schedule.amount.add(schedule.lateFee).sub(schedule.amountPaid),
          currency: schedule.currency,
          meta: { rentScheduleId: schedule.id },
          partial: {
            allowed: schedule.lease.allowPartialPayments,
            min: schedule.lease.minPartialAmount,
          },
        };
      }

      case 'SALE_INSTALLMENT': {
        const installment = await this.prisma.saleInstallment.findUnique({
          where: { id: target.id },
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
        if (installment.agreement.buyerId !== userId) {
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
        return {
          type: 'SALE_INSTALLMENT',
          id: installment.id,
          metaKey: 'saleInstallmentId',
          due: installment.amount,
          currency: installment.currency,
          meta: { saleInstallmentId: installment.id },
          partial: { allowed: false, min: null },
        };
      }

      case 'BOOKING': {
        const booking = await this.prisma.booking.findUnique({
          where: { id: target.id },
        });
        if (!booking) {
          throw new NotFoundException({
            code: 'BOOKING_NOT_FOUND',
            message: 'Booking does not exist',
          });
        }
        if (booking.userId !== userId) {
          throw new ForbiddenException({
            code: 'NOT_PAYER',
            message: 'Only the guest who booked can pay this stay',
          });
        }
        if (
          booking.status === 'CANCELLED' ||
          booking.status === 'COMPLETED'
        ) {
          throw new BadRequestException({
            code: 'BOOKING_NOT_PAYABLE',
            message: `A ${booking.status.toLowerCase()} booking cannot be paid`,
          });
        }
        return {
          type: 'BOOKING',
          id: booking.id,
          metaKey: 'bookingId',
          due: booking.totalPrice,
          currency: booking.currency,
          meta: { bookingId: booking.id },
          partial: { allowed: false, min: null },
        };
      }

      case 'VISIT_BOOKING': {
        const visit = await this.prisma.visitBooking.findUnique({
          where: { id: target.id },
          include: {
            slot: {
              select: {
                property: { select: { visitPrice: true, currency: true } },
              },
            },
          },
        });
        if (!visit) {
          throw new NotFoundException({
            code: 'VISIT_BOOKING_NOT_FOUND',
            message: 'Visit booking does not exist',
          });
        }
        if (visit.userId !== userId) {
          throw new ForbiddenException({
            code: 'NOT_PAYER',
            message: 'Only the visitor who booked can pay this visit',
          });
        }
        const price = visit.slot.property.visitPrice;
        if (!price || price.lte(0)) {
          throw new BadRequestException({
            code: 'VISIT_PRICE_NOT_SET',
            message: 'This property has no paid visit configured',
          });
        }
        return {
          type: 'VISIT_BOOKING',
          id: visit.id,
          metaKey: 'visitBookingId',
          due: price,
          currency: visit.slot.property.currency,
          meta: { visitBookingId: visit.id },
          partial: { allowed: false, min: null },
        };
      }
    }
  }

  /**
   * Spec 05 — montant serveur : le reste dû fait foi ; un montant client
   * différent n'est accepté que pour un partiel autorisé (≥ minPartialAmount).
   */
  private computeAmount(
    target: ResolvedTarget | null,
    input: InitiatePaymentInput,
  ): Prisma.Decimal {
    if (!target) {
      const client = this.toDecimal(input.amount);
      if (!client.gt(0)) {
        throw new BadRequestException({
          code: 'INVALID_AMOUNT',
          message: 'Amount must be a positive number',
        });
      }
      return client;
    }

    if (!target.due.gt(0)) {
      throw new BadRequestException({
        code: 'NOTHING_DUE',
        message: 'This payment target is already fully settled',
      });
    }
    if (input.amount === undefined || input.amount === null) {
      return target.due;
    }
    const client = this.toDecimal(input.amount);
    if (!client.gt(0)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Amount must be a positive number',
      });
    }
    if (client.eq(target.due)) return client;
    if (!target.partial.allowed) {
      throw new BadRequestException({
        code: 'AMOUNT_MISMATCH',
        message: `Amount must equal the amount due (${target.due.toString()})`,
      });
    }
    if (client.gt(target.due)) {
      throw new BadRequestException({
        code: 'AMOUNT_MISMATCH',
        message: `A partial payment cannot exceed the amount due (${target.due.toString()})`,
      });
    }
    const min = target.partial.min;
    if (min && client.lt(min)) {
      throw new BadRequestException({
        code: 'PARTIAL_MIN_NOT_MET',
        message: `A partial payment must be at least ${min.toString()}`,
      });
    }
    return client;
  }

  private toDecimal(value: string | number | undefined | null): Prisma.Decimal {
    try {
      const decimal = new Prisma.Decimal(String(value ?? 0));
      return decimal.isNaN() ? new Prisma.Decimal(0) : decimal;
    } catch {
      return new Prisma.Decimal(0);
    }
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
    const tenantUserId = schedule.lease.tenantId;
    if (!tenantUserId) {
      throw new BadRequestException({
        code: 'LEASE_TENANT_NOT_LINKED',
        message:
          'Ce bail na pas encore de locataire associe. Reliez le locataire avant d\'enregistrer un paiement.',
      });
    }
    const session = await this.cashProvider.initiate({
      userId: tenantUserId,
      amount,
      currency,
      idempotencyKey: input.idempotencyKey,
    });

    const metadata: PaymentMetadata = {
      rentScheduleId: schedule.id,
      recordedByAgent: true,
      ...(input.note ? { note: input.note } : {}),
    };

    // Spec 05 P2 — double validation espèces : quand l'orga l'exige, le
    // paiement enregistré reste PENDING_VALIDATION et un second gestionnaire
    // devra le valider (le registraire ne peut pas être le validateur).
    const org = await this.prisma.organization.findUnique({
      where: { id: schedule.lease.property.organizationId },
      select: { requireDualCashValidation: true },
    });
    const dualPending = Boolean(org?.requireDualCashValidation);

    const result = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId: tenantUserId,
          amount: new Prisma.Decimal(amount),
          currency,
          method: 'CASH',
          status: dualPending
            ? PaymentStatus.PENDING_VALIDATION
            : PaymentStatus.VALIDATED,
          reference: session.reference,
          idempotencyKey: input.idempotencyKey,
          recordedById: agentUserId,
          ...(dualPending
            ? {}
            : { validatedBy: agentUserId, validatedAt: new Date() }),
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      let settled: string[] = [];
      if (!dualPending) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: created.id,
            type: AllocatableType.RENT_SCHEDULE,
            refId: schedule.id,
            amount: new Prisma.Decimal(amount),
            rentScheduleId: schedule.id,
          },
        });
        settled = await this.maybeMarkRentSchedulePaid(tx, schedule.id);
      }
      const payment = await tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: { allocations: true },
      });
      return { payment, settled };
    });

    if (!dualPending) {
      await this.events.emit(DOMAIN_EVENTS.PAYMENT_VALIDATED, {
        paymentId: result.payment.id,
        userId: result.payment.userId,
        amount: result.payment.amount.toString(),
        currency: result.payment.currency,
      });

      await this.issueQuittances(result.settled);
    }

    return this.toPublic(result.payment);
  }

  /** Spec 04 — a quittance is issued as soon as a line reaches its balance. */
  private async issueQuittances(rentScheduleIds: string[]): Promise<void> {
    for (const id of rentScheduleIds) {
      try {
        await this.rentReceipts.issueForRentSchedule(id);
      } catch (err) {
        this.logger.error(
          `Quittance issuance failed for schedule ${id}: ${String(err)}`,
        );
      }
    }
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

    // Spec 05 P2 — double validation espèces (voir ci-dessus).
    const org = await this.prisma.organization.findUnique({
      where: { id: installment.agreement.property.organizationId },
      select: { requireDualCashValidation: true },
    });
    const dualPending = Boolean(org?.requireDualCashValidation);

    const updated = await this.prisma.$transaction(async (tx) => {
      const created = await tx.payment.create({
        data: {
          userId: buyerId,
          amount: new Prisma.Decimal(amount),
          currency,
          method: 'CASH',
          status: dualPending
            ? PaymentStatus.PENDING_VALIDATION
            : PaymentStatus.VALIDATED,
          reference: session.reference,
          idempotencyKey: input.idempotencyKey,
          recordedById: agentUserId,
          ...(dualPending
            ? {}
            : { validatedBy: agentUserId, validatedAt: new Date() }),
          metadata: metadata as Prisma.InputJsonValue,
        },
      });
      if (!dualPending) {
        await tx.paymentAllocation.create({
          data: {
            paymentId: created.id,
            type: AllocatableType.SALE_INSTALLMENT,
            refId: installment.id,
            amount: new Prisma.Decimal(amount),
          },
        });
        await this.maybeMarkSaleInstallmentPaid(tx, installment.id);
      }
      return tx.payment.findUniqueOrThrow({
        where: { id: created.id },
        include: { allocations: true },
      });
    });

    if (!dualPending) {
      await this.events.emit(DOMAIN_EVENTS.PAYMENT_VALIDATED, {
        paymentId: updated.id,
        userId: updated.userId,
        amount: updated.amount.toString(),
        currency: updated.currency,
      });
    }

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

    // Spec 05 P2 — double validation espèces : le gestionnaire qui a
    // enregistré le paiement ne peut pas être le validateur quand l'orga
    // l'exige (`org.requireDualCashValidation`).
    if (property && payment.recordedById === agentUserId) {
      const org = await this.prisma.organization.findUnique({
        where: { id: property.organizationId },
        select: { requireDualCashValidation: true },
      });
      if (org?.requireDualCashValidation) {
        throw new BadRequestException({
          code: 'DUAL_VALIDATION_REQUIRED',
          message:
            'Ce paiement en espèces doit être validé par un second gestionnaire (double validation)',
        });
      }
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
   * Legacy generic webhook (`payments/webhooks/mobile-money`): HMAC signature,
   * { reference, status } payload, then the shared idempotent settle.
   */
  async handleMobileMoneyWebhook(
    rawPayload: string,
    signature: string,
  ): Promise<PublicPayment> {
    if (!this.mobileMoneyProvider.verifyWebhookSignature(rawPayload, signature)) {
      throw new BadRequestException({
        code: 'WEBHOOK_SIGNATURE_INVALID',
        message: 'Invalid webhook signature',
      });
    }
    const parsed = this.mobileMoneyProvider.parseGenericWebhook(rawPayload);
    if (!parsed.providerRef) {
      throw new BadRequestException({
        code: 'WEBHOOK_REFERENCE_MISSING',
        message: 'No payment reference in webhook',
      });
    }
    const payment = await this.findForWebhook(parsed.providerRef);
    return this.applyProviderOutcome(payment.id, parsed.outcome, {
      provider: payment.provider ?? 'AIRTEL',
      kind: 'WEBHOOK',
      payload: { raw: this.safeJson(rawPayload) },
      signatureValid: true,
    });
  }

  /**
   * Spec 05 P0 — adapted webhook (`payments/webhooks/airtel` / `momo`):
   * per-provider signature + IP allowlist, raw payload journalised in
   * `PaymentEvent`, idempotent settle keyed on `providerRef`.
   */
  async handleProviderWebhook(
    provider: 'AIRTEL' | 'MOMO',
    rawPayload: string,
    signature: string | undefined,
    ip: string | undefined,
  ): Promise<PublicPayment> {
    const verification = this.mobileMoneyProvider.verifyProviderWebhook(
      provider,
      rawPayload,
      signature,
      ip,
    );
    const parsed = this.mobileMoneyProvider.parseWebhook(provider, rawPayload);
    if (!parsed.providerRef) {
      throw new BadRequestException({
        code: 'WEBHOOK_REFERENCE_MISSING',
        message: 'No provider reference in webhook',
      });
    }
    const payment = await this.findForWebhook(parsed.providerRef);

    // The payload only says which transaction to re-check: the final status
    // always comes from the operator API (AuraSpot pattern), except when the
    // payload itself already carries a final state.
    let outcome = parsed.outcome;
    if (!verification.valid) {
      await this.logEvent(payment.id, provider, 'WEBHOOK', {
        raw: this.safeJson(rawPayload),
        rejected: verification.reason,
      }, false);
      throw new BadRequestException({
        code: 'WEBHOOK_REJECTED',
        message: `Webhook rejected: ${verification.reason ?? 'unknown'}`,
      });
    }
    if (outcome === 'PENDING') {
      outcome = await this.mobileMoneyProvider.getStatus(
        provider,
        payment.providerRef ?? payment.reference,
      );
    }
    return this.applyProviderOutcome(payment.id, outcome, {
      provider,
      kind: 'WEBHOOK',
      payload: { raw: this.safeJson(rawPayload) },
      signatureValid: true,
    });
  }

  private async findForWebhook(
    reference: string,
  ): Promise<Payment & { allocations: PaymentAllocation[] }> {
    const payment = await this.prisma.payment.findFirst({
      where: { OR: [{ providerRef: reference }, { reference }] },
      include: { allocations: true },
    });
    if (!payment) {
      throw new NotFoundException({
        code: 'PAYMENT_NOT_FOUND',
        message: `No payment for reference ${reference}`,
      });
    }
    return payment;
  }

  private safeJson(raw: string): Prisma.JsonValue {
    try {
      return JSON.parse(raw) as Prisma.JsonValue;
    } catch {
      return { raw };
    }
  }

  /** Spec 05 — journalise chaque échange fournisseur (brut, auditable). */
  private async logEvent(
    paymentId: string | null,
    provider: string,
    kind: string,
    payload: Record<string, unknown>,
    signatureValid?: boolean,
  ): Promise<void> {
    await this.prisma.paymentEvent.create({
      data: {
        paymentId,
        provider,
        kind,
        payload: payload as unknown as Prisma.InputJsonValue,
        ...(signatureValid !== undefined ? { signatureValid } : {}),
      },
    });
  }

  /**
   * Spec 05 — applies a final provider outcome, idempotently:
   * VALIDATED allocates (once) + emits PAYMENT_VALIDATED + issues the
   * quittance; FAILED / EXPIRED only leave the INITIATED state.
   */
  private async applyProviderOutcome(
    paymentId: string,
    outcome: ProviderOutcome,
    ctx: OutcomeContext,
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
    await this.logEvent(
      payment.id,
      ctx.provider,
      ctx.kind,
      ctx.payload,
      ctx.signatureValid,
    );

    if (outcome === 'PENDING') return this.toPublic(payment);

    if (outcome === 'VALIDATED') {
      // Idempotent: two identical webhooks allocate and receipt exactly once.
      if (payment.status !== PaymentStatus.INITIATED) {
        return this.toPublic(payment);
      }
      const meta = (payment.metadata ?? {}) as PaymentMetadata;
      const settled = await this.prisma.$transaction(async (tx) => {
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.VALIDATED, validatedAt: new Date() },
        });
        if (payment.allocations.length === 0) {
          await this.allocateFromMetadata(tx, payment, meta);
        }
        return tx.payment.findUniqueOrThrow({
          where: { id: payment.id },
          include: { allocations: true },
        });
      });
      const settledIds = await this.settleAllocatedTargets(settled);

      await this.events.emit(DOMAIN_EVENTS.PAYMENT_VALIDATED, {
        paymentId: settled.id,
        userId: settled.userId,
        amount: settled.amount.toString(),
        currency: settled.currency,
      });
      await this.issueQuittances(settledIds);
      return this.toPublic(settled);
    }

    if (payment.status !== PaymentStatus.INITIATED) {
      return this.toPublic(payment);
    }
    const reason =
      ctx.reason ??
      (outcome === 'EXPIRED' ? 'EXPIRED_WITHOUT_CONFIRMATION' : 'PROVIDER_FAILED');
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: {
        status:
          outcome === 'EXPIRED'
            ? PaymentStatus.EXPIRED
            : PaymentStatus.FAILED,
        failureReason: reason,
      },
      include: { allocations: true },
    });
    if (outcome === 'EXPIRED') {
      await this.events.emit(DOMAIN_EVENTS.PAYMENT_EXPIRED, {
        paymentId: updated.id,
        userId: updated.userId,
        amount: updated.amount.toString(),
        currency: updated.currency,
        reason,
      });
    } else {
      await this.events.emit(DOMAIN_EVENTS.PAYMENT_FAILED, {
        paymentId: updated.id,
        userId: updated.userId,
        amount: updated.amount.toString(),
        currency: updated.currency,
        reason,
      });
    }
    return this.toPublic(updated);
  }

  /** Creates the allocations carried by the payment metadata (once). */
  private async allocateFromMetadata(
    tx: Prisma.TransactionClient,
    payment: Payment,
    meta: PaymentMetadata,
  ): Promise<void> {
    const amount = payment.amount;
    if (typeof meta.rentScheduleId === 'string') {
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          type: AllocatableType.RENT_SCHEDULE,
          refId: meta.rentScheduleId,
          amount,
          rentScheduleId: meta.rentScheduleId,
        },
      });
      return;
    }
    if (typeof meta.saleInstallmentId === 'string') {
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          type: AllocatableType.SALE_INSTALLMENT,
          refId: meta.saleInstallmentId,
          amount,
        },
      });
      return;
    }
    if (typeof meta.bookingId === 'string') {
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          type: AllocatableType.BOOKING,
          refId: meta.bookingId,
          amount,
        },
      });
      return;
    }
    if (typeof meta.visitBookingId === 'string') {
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          type: AllocatableType.VISIT_BOOKING,
          refId: meta.visitBookingId,
          amount,
        },
      });
    }
  }

  /** Flips the allocated targets (PAID lines etc.) after a settle. */
  private async settleAllocatedTargets(
    payment: Payment & { allocations: PaymentAllocation[] },
  ): Promise<string[]> {
    let settled: string[] = [];
    for (const allocation of payment.allocations) {
      if (allocation.type === 'RENT_SCHEDULE' && allocation.rentScheduleId) {
        settled = settled.concat(
          await this.maybeMarkRentSchedulePaid(
            this.prisma,
            allocation.rentScheduleId,
          ),
        );
      } else if (allocation.type === 'SALE_INSTALLMENT') {
        await this.maybeMarkSaleInstallmentPaid(this.prisma, allocation.refId);
      }
    }
    return settled;
  }

  /**
   * Spec 05 — `GET payments/:id/status` : relit le statut chez le fournisseur
   * quand le paiement est encore INITIATED.
   */
  async getPaymentStatus(
    userId: string,
    paymentId: string,
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
    await this.assertCanReadPayment(userId, payment);

    if (payment.status === PaymentStatus.INITIATED && payment.provider) {
      const outcome = await this.mobileMoneyProvider.getStatus(
        payment.provider,
        payment.providerRef ?? payment.reference,
      );
      if (outcome !== 'PENDING') {
        return this.applyProviderOutcome(payment.id, outcome, {
          provider: payment.provider,
          kind: 'STATUS_POLL',
          payload: { source: 'client-status' },
        });
      }
      await this.logEvent(payment.id, payment.provider, 'STATUS_POLL', {
        source: 'client-status',
        outcome,
      });
    }
    return this.toPublic(payment);
  }

  /** Spec 05 — `POST payments/:id/cancel` : seul le payeur, INITIATED. */
  async cancelPayment(userId: string, paymentId: string): Promise<PublicPayment> {
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
    if (payment.userId !== userId) {
      throw new ForbiddenException({
        code: 'PAYMENT_FORBIDDEN',
        message: 'Only the payer can cancel this payment',
      });
    }
    if (payment.status !== PaymentStatus.INITIATED) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_CANCELLABLE',
        message: `A payment in status ${payment.status} cannot be cancelled`,
      });
    }
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: PaymentStatus.CANCELLED, failureReason: 'Cancelled by payer' },
      include: { allocations: true },
    });
    return this.toPublic(updated);
  }

  /**
   * Spec 05 — `GET payments/quote` : montant dû, partiel autorisé, minimum.
   */
  async quote(
    userId: string,
    targetType: PaymentTargetType,
    targetId: string,
  ): Promise<{
    targetType: PaymentTargetType;
    targetId: string;
    due: string;
    currency: string;
    allowPartial: boolean;
    minPartial: string | null;
  }> {
    const target = await this.resolveTarget(userId, { type: targetType, id: targetId });
    if (!target) {
      throw new BadRequestException({
        code: 'TARGET_REQUIRED',
        message: 'targetType and targetId are required',
      });
    }
    return {
      targetType: target.type,
      targetId: target.id,
      due: target.due.toString(),
      currency: target.currency,
      allowPartial: target.partial.allowed,
      minPartial: target.partial.min?.toString() ?? null,
    };
  }

  /**
   * Spec 05 — expiration : un INITIATED non confirmé après 15 minutes passe à
   * EXPIRED (le fournisseur est interrogé juste avant, cron toutes les 5 min).
   */
  async expireDuePayments(
    now = new Date(),
  ): Promise<{ processed: number; confirmed: number; expired: number }> {
    const due = await this.prisma.payment.findMany({
      where: {
        status: PaymentStatus.INITIATED,
        expiresAt: { lte: now },
      },
      select: { id: true, provider: true, providerRef: true, reference: true },
      take: 100,
    });
    let confirmed = 0;
    let expired = 0;
    for (const row of due) {
      const provider = row.provider ?? 'AIRTEL';
      const outcome = await this.mobileMoneyProvider.getStatus(
        provider,
        row.providerRef ?? row.reference,
      );
      if (outcome === 'PENDING') {
        await this.applyProviderOutcome(row.id, 'EXPIRED', {
          provider,
          kind: 'STATUS_POLL',
          payload: { source: 'expiry-cron' },
          reason: 'EXPIRED_AFTER_15_MIN',
        });
        expired += 1;
      } else {
        await this.applyProviderOutcome(row.id, outcome, {
          provider,
          kind: 'STATUS_POLL',
          payload: { source: 'expiry-cron' },
        });
        if (outcome === 'VALIDATED') confirmed += 1;
        else expired += 1;
      }
    }
    return { processed: due.length, confirmed, expired };
  }

  // ------------------------------------------------------------------
  // Spec 05 P1 — remboursements
  // ------------------------------------------------------------------

  /** `POST payments/:id/refunds` — manager or platform admin. */
  async createRefund(
    managerId: string,
    paymentId: string,
    input: CreateRefundInput,
  ): Promise<PublicRefund> {
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
    await this.assertCanManagePayment(managerId, payment);
    const refundable: PaymentStatus[] = [
      PaymentStatus.VALIDATED,
      PaymentStatus.DISPUTED,
      PaymentStatus.PARTIALLY_REFUNDED,
    ];
    if (!refundable.includes(payment.status)) {
      throw new BadRequestException({
        code: 'PAYMENT_NOT_REFUNDABLE',
        message: `A payment in status ${payment.status} cannot be refunded`,
      });
    }
    const remaining = payment.amount.sub(payment.refundedAmount);
    if (!remaining.gt(0)) {
      throw new BadRequestException({
        code: 'PAYMENT_ALREADY_REFUNDED',
        message: 'This payment has already been fully refunded',
      });
    }
    const amount =
      input.amount !== undefined ? this.toDecimal(input.amount) : remaining;
    if (!amount.gt(0)) {
      throw new BadRequestException({
        code: 'INVALID_AMOUNT',
        message: 'Refund amount must be positive',
      });
    }
    if (amount.gt(remaining)) {
      throw new BadRequestException({
        code: 'REFUND_EXCEEDS_BALANCE',
        message: `A refund cannot exceed the paid amount minus refunds (${remaining.toString()})`,
      });
    }
    if (input.method === 'CASH' && !input.proofKey) {
      throw new BadRequestException({
        code: 'REFUND_PROOF_REQUIRED',
        message: 'A cash refund requires a proof key (justificatif)',
      });
    }

    const threshold = await this.refundThreshold(
      await this.paymentPropertyId(payment),
    );
    const needsApproval = amount.gt(threshold);
    const refund = await this.prisma.refund.create({
      data: {
        paymentId: payment.id,
        amount,
        reason: input.reason,
        method: input.method,
        proofKey: input.proofKey ?? null,
        requestedById: managerId,
        status: needsApproval ? 'REQUESTED' : 'APPROVED',
      },
    });
    if (needsApproval) return this.toPublicRefund(refund);
    return this.toPublicRefund(await this.executeRefund(refund.id, managerId));
  }

  /** `PATCH /refunds/:id` — a platform admin approves or rejects. */
  async decideRefund(
    adminId: string,
    refundId: string,
    decision: { decision: 'APPROVE' | 'REJECT'; comment?: string },
  ): Promise<PublicRefund> {
    if (!(await this.isPlatformAdmin(adminId))) {
      throw new ForbiddenException({
        code: 'NOT_PLATFORM_ADMIN',
        message: 'Only a platform admin can decide a refund',
      });
    }
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
    });
    if (!refund) {
      throw new NotFoundException({
        code: 'REFUND_NOT_FOUND',
        message: 'Refund does not exist',
      });
    }
    if (refund.status !== 'REQUESTED') {
      throw new BadRequestException({
        code: 'REFUND_ALREADY_DECIDED',
        message: `This refund is already ${refund.status.toLowerCase()}`,
      });
    }
    if (decision.decision === 'REJECT') {
      const rejected = await this.prisma.refund.update({
        where: { id: refund.id },
        data: {
          status: 'REJECTED',
          approvedById: adminId,
          failureReason: decision.comment ?? 'Rejected by platform admin',
        },
      });
      return this.toPublicRefund(rejected);
    }
    const approved = await this.prisma.refund.update({
      where: { id: refund.id },
      data: { status: 'APPROVED', approvedById: adminId },
    });
    return this.toPublicRefund(await this.executeRefund(approved.id, adminId));
  }

  /**
   * Executes a refund exactly once: reverses the allocations (the rent line
   * falls back to PENDING / PARTIAL), moves the payment to REFUNDED or
   * PARTIALLY_REFUNDED and writes the `REFUND` ledger entry (spec 05).
   */
  private async executeRefund(
    refundId: string,
    approvedById: string | null,
  ): Promise<Refund> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: { payment: { include: { allocations: true } } },
    });
    if (!refund) {
      throw new NotFoundException({
        code: 'REFUND_NOT_FOUND',
        message: 'Refund does not exist',
      });
    }
    if (refund.status === 'SUCCEEDED') return refund;
    if (!['REQUESTED', 'APPROVED'].includes(refund.status)) {
      throw new BadRequestException({
        code: 'REFUND_NOT_EXECUTABLE',
        message: `A refund in status ${refund.status} cannot be executed`,
      });
    }

    const payment = refund.payment;
    const propertyId = await this.paymentPropertyId(payment);
    const property = propertyId
      ? await this.prisma.property.findUnique({
          where: { id: propertyId },
          select: { id: true, organizationId: true },
        })
      : null;
    const mandate = propertyId ? await this.liveMandate(propertyId) : null;

    const affectedSchedules = new Set<string>();
    let affectedInstallmentId: string | null = null;

    const executed = await this.prisma.$transaction(async (tx) => {
      // Reverse the refund's share of the allocations, oldest first.
      let remaining = new Prisma.Decimal(refund.amount);
      const ordered = [...payment.allocations].sort(
        (a, b) => a.createdAt.getTime() - b.createdAt.getTime(),
      );
      for (const allocation of ordered) {
        if (!remaining.gt(0)) break;
        const take = Prisma.Decimal.min(remaining, allocation.amount);
        const left = allocation.amount.sub(take);
        if (left.lte(0)) {
          await tx.paymentAllocation.delete({ where: { id: allocation.id } });
        } else {
          await tx.paymentAllocation.update({
            where: { id: allocation.id },
            data: { amount: left },
          });
        }
        remaining = remaining.sub(take);
        if (allocation.rentScheduleId) {
          affectedSchedules.add(allocation.rentScheduleId);
        } else if (allocation.type === 'SALE_INSTALLMENT') {
          affectedInstallmentId = allocation.refId;
        }
      }

      // Recompute the rent lines the money came from.
      for (const scheduleId of affectedSchedules) {
        await this.recomputeScheduleBalance(tx, scheduleId);
      }
      if (affectedInstallmentId) {
        const installment = await tx.saleInstallment.findUnique({
          where: { id: affectedInstallmentId },
        });
        if (installment) {
          const sum = await tx.paymentAllocation.aggregate({
            where: { type: 'SALE_INSTALLMENT', refId: affectedInstallmentId },
            _sum: { amount: true },
          });
          const paid = sum._sum.amount ?? new Prisma.Decimal(0);
          await tx.saleInstallment.update({
            where: { id: affectedInstallmentId },
            data: {
              status: paid.gte(installment.amount) ? 'PAID' : 'PENDING',
            },
          });
        }
      }

      const refundedTotal = payment.refundedAmount.add(refund.amount);
      const updatedPayment = await tx.payment.update({
        where: { id: payment.id },
        data: {
          refundedAmount: refundedTotal,
          status: refundedTotal.gte(payment.amount)
            ? PaymentStatus.REFUNDED
            : PaymentStatus.PARTIALLY_REFUNDED,
        },
      });

      const updatedRefund = await tx.refund.update({
        where: { id: refund.id },
        data: {
          status: 'SUCCEEDED',
          processedAt: new Date(),
          ...(approvedById ? { approvedById } : {}),
          ...(refund.method === 'PROVIDER'
            ? { providerRef: `rfb-${randomUUID()}` }
            : {}),
        },
      });

      if (property) {
        const existingEntry = await tx.ledgerEntry.findFirst({
          where: { sourceType: 'REFUND', sourceId: refund.id, type: 'REFUND' },
          select: { id: true },
        });
        if (!existingEntry) {
          await tx.ledgerEntry.create({
            data: {
              propertyId: property.id,
              mandateId: mandate?.id ?? null,
              ownerOrgId: property.organizationId,
              agencyOrgId: mandate?.organizationId ?? null,
              type: 'REFUND',
              amount: new Prisma.Decimal(refund.amount).neg(),
              currency: updatedPayment.currency,
              sourceType: 'REFUND',
              sourceId: refund.id,
              label: `Remboursement — ${refund.reason}`,
              occurredAt: new Date(),
            },
          });
        }
      }
      return updatedRefund;
    });

    await this.events.emit(DOMAIN_EVENTS.PAYMENT_REFUNDED, {
      paymentId: payment.id,
      refundId: executed.id,
      amount: executed.amount.toString(),
      currency: payment.currency,
    });
    return executed;
  }

  /** Puts a rent line back to PENDING / PARTIAL / PAID after a reversal. */
  private async recomputeScheduleBalance(
    tx: Prisma.TransactionClient,
    scheduleId: string,
  ): Promise<void> {
    const schedule = await tx.rentSchedule.findUnique({
      where: { id: scheduleId },
    });
    if (!schedule) return;
    if (
      schedule.status === RentScheduleStatus.CANCELLED ||
      schedule.status === RentScheduleStatus.WAIVED
    ) {
      return;
    }
    const sum = await tx.paymentAllocation.aggregate({
      where: { rentScheduleId: scheduleId },
      _sum: { amount: true },
    });
    const paid = sum._sum.amount ?? new Prisma.Decimal(0);
    await tx.rentSchedule.update({
      where: { id: scheduleId },
      data: {
        amountPaid: paid,
        status:
          paid.lte(0)
            ? RentScheduleStatus.PENDING
            : paid.gte(schedule.amount)
              ? RentScheduleStatus.PAID
              : RentScheduleStatus.PARTIAL,
      },
    });
  }

  private async refundThreshold(propertyId: string | null): Promise<Prisma.Decimal> {
    if (!propertyId) return new Prisma.Decimal(0);
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { organization: { select: { refundApprovalThreshold: true } } },
    });
    return property?.organization.refundApprovalThreshold ?? new Prisma.Decimal(0);
  }

  private async liveMandate(propertyId: string) {
    return this.prisma.mandate.findFirst({
      where: {
        propertyId,
        OR: [
          { status: 'ACTIVE' },
          { status: 'TERMINATING', terminationEffectiveAt: { gt: new Date() } },
        ],
      },
      select: { id: true, organizationId: true },
    });
  }

  // ------------------------------------------------------------------
  // Spec 05 P1 — litiges
  // ------------------------------------------------------------------

  /** `POST payments/:id/disputes` — the payer contests within 30 days. */
  async openDispute(
    userId: string,
    paymentId: string,
    input: OpenDisputeInput,
  ): Promise<PublicDispute> {
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
    if (payment.userId !== userId) {
      throw new ForbiddenException({
        code: 'PAYMENT_FORBIDDEN',
        message: 'Only the payer can contest this payment',
      });
    }
    const open = await this.prisma.paymentDispute.findFirst({
      where: { paymentId, status: { in: ['OPEN', 'AWAITING_MANAGER', 'ESCALATED'] } },
      select: { id: true },
    });
    if (open) {
      throw new ConflictException({
        code: 'DISPUTE_ALREADY_OPEN',
        message: 'An open dispute already exists for this payment',
      });
    }
    const disputable: PaymentStatus[] = [
      PaymentStatus.VALIDATED,
      PaymentStatus.PARTIALLY_REFUNDED,
    ];
    if (!disputable.includes(payment.status)) {
      throw new BadRequestException({
        code: 'DISPUTE_NOT_ALLOWED',
        message: `A payment in status ${payment.status} cannot be disputed`,
      });
    }
    const age = Date.now() - payment.createdAt.getTime();
    if (age > 30 * 86_400_000) {
      throw new BadRequestException({
        code: 'DISPUTE_WINDOW_CLOSED',
        message: 'A dispute can only be opened within 30 days of the payment',
      });
    }

    const dispute = await this.prisma.$transaction(async (tx) => {
      const created = await tx.paymentDispute.create({
        data: {
          paymentId,
          openedById: userId,
          reason: input.reason,
          description: input.description,
          evidenceKeys: input.evidenceKeys ?? [],
        },
      });
      await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.DISPUTED },
      });
      return created;
    });

    await this.events.emit(DOMAIN_EVENTS.PAYMENT_DISPUTED, {
      paymentId,
      disputeId: dispute.id,
      openedBy: userId,
      reason: input.reason,
    });
    return this.toPublicDispute(dispute);
  }

  /** `GET disputes/managed` — litiges du périmètre (admin : tous). */
  async listManagedDisputes(userId: string): Promise<PublicDispute[]> {
    const admin = await this.isPlatformAdmin(userId);
    const rows = await this.prisma.paymentDispute.findMany({
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: { payment: { include: { allocations: true } } },
    });
    if (admin) return rows.map((row) => this.toPublicDispute(row));

    const propertyIds = new Set(await this.accessiblePropertyIds(userId));
    const visible: PublicDispute[] = [];
    for (const row of rows) {
      const propertyId = await this.paymentPropertyId(row.payment);
      if (propertyId && propertyIds.has(propertyId)) {
        visible.push(this.toPublicDispute(row));
      }
    }
    return visible;
  }

  /** `PATCH disputes/:id` — manager or admin resolves / answers the litige. */
  async resolveDispute(
    actorId: string,
    disputeId: string,
    input: { status: string; resolution?: string },
  ): Promise<PublicDispute> {
    const dispute = await this.prisma.paymentDispute.findUnique({
      where: { id: disputeId },
      include: { payment: { include: { allocations: true } } },
    });
    if (!dispute) {
      throw new NotFoundException({
        code: 'DISPUTE_NOT_FOUND',
        message: 'Dispute does not exist',
      });
    }
    const admin = await this.isPlatformAdmin(actorId);
    if (!admin) {
      const propertyId = await this.paymentPropertyId(dispute.payment);
      const propertyIds = await this.accessiblePropertyIds(actorId);
      if (!propertyId || !propertyIds.includes(propertyId)) {
        throw new ForbiddenException({
          code: 'PAYMENT_FORBIDDEN',
          message: 'You are not authorized to handle this dispute',
        });
      }
    }

    const allowed = ['AWAITING_MANAGER', 'RESOLVED_ACCEPTED', 'RESOLVED_REJECTED'];
    if (!allowed.includes(input.status)) {
      throw new BadRequestException({
        code: 'DISPUTE_INVALID_STATUS',
        message: `A dispute can only move to ${allowed.join(', ')}`,
      });
    }
    const resolving = input.status.startsWith('RESOLVED');
    const updated = await this.prisma.$transaction(async (tx) => {
      const row = await tx.paymentDispute.update({
        where: { id: dispute.id },
        data: {
          status: input.status as never,
          ...(input.resolution ? { resolution: input.resolution } : {}),
          ...(resolving
            ? { resolvedById: actorId, resolvedAt: new Date() }
            : {}),
        },
      });
      // Contest refused: the money goes back to VALIDATED (back in payouts).
      if (input.status === 'RESOLVED_REJECTED') {
        await tx.payment.update({
          where: { id: dispute.paymentId },
          data: { status: PaymentStatus.VALIDATED },
        });
      }
      return row;
    });
    return this.toPublicDispute(updated);
  }

  /** Spec 05 — a manager answer is due within 72 h, then escalate to admin. */
  async escalateOverdueDisputes(
    now = new Date(),
  ): Promise<{ escalated: number }> {
    const cutoff = new Date(now.getTime() - 72 * 3_600_000);
    const overdue = await this.prisma.paymentDispute.findMany({
      where: { status: 'OPEN', createdAt: { lte: cutoff } },
      select: { id: true, paymentId: true },
      take: 100,
    });
    if (overdue.length === 0) return { escalated: 0 };
    await this.prisma.paymentDispute.updateMany({
      where: { id: { in: overdue.map((d) => d.id) } },
      data: { status: 'ESCALATED' },
    });
    return { escalated: overdue.length };
  }

  // ------------------------------------------------------------------
  // Access helpers
  // ------------------------------------------------------------------

  private async isPlatformAdmin(userId: string): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { roles: true },
    });
    return (
      user?.roles.some((role) => role.role === 'PLATFORM_ADMIN') ?? false
    );
  }

  /** Refunds / disputes: platform admin, or a manager of the target property. */
  private async assertCanManagePayment(
    userId: string,
    payment: Payment & { allocations: PaymentAllocation[] },
  ): Promise<void> {
    if (await this.isPlatformAdmin(userId)) return;
    const propertyId = await this.paymentPropertyId(payment);
    const propertyIds = propertyId
      ? await this.accessiblePropertyIds(userId)
      : [];
    if (!propertyId || !propertyIds.includes(propertyId)) {
      throw new ForbiddenException({
        code: 'PAYMENT_FORBIDDEN',
        message: 'You are not authorized to manage this payment',
      });
    }
  }

  /** The property a payment ultimately belongs to (null for legacy rows). */
  private async paymentPropertyId(
    payment: Payment & { allocations: PaymentAllocation[] },
  ): Promise<string | null> {
    const meta = (payment.metadata ?? {}) as PaymentMetadata;
    for (const allocation of payment.allocations) {
      const propertyId = await this.allocationPropertyId(allocation);
      if (propertyId) return propertyId;
    }
    const metaTargets: Array<['rentScheduleId' | 'saleInstallmentId' | 'bookingId' | 'visitBookingId', string]> = [];
    for (const key of [
      'rentScheduleId',
      'saleInstallmentId',
      'bookingId',
      'visitBookingId',
    ] as const) {
      if (typeof meta[key] === 'string') {
        metaTargets.push([key, meta[key] as string]);
      }
    }
    for (const [key, id] of metaTargets) {
      const propertyId = await this.targetPropertyId(key, id);
      if (propertyId) return propertyId;
    }
    if (payment.bookingId) {
      return this.targetPropertyId('bookingId', payment.bookingId);
    }
    return null;
  }

  private async allocationPropertyId(
    allocation: PaymentAllocation,
  ): Promise<string | null> {
    if (allocation.type === 'RENT_SCHEDULE' && allocation.rentScheduleId) {
      const schedule = await this.prisma.rentSchedule.findUnique({
        where: { id: allocation.rentScheduleId },
        select: { lease: { select: { propertyId: true } } },
      });
      return schedule?.lease.propertyId ?? null;
    }
    if (
      allocation.type === 'SALE_INSTALLMENT' ||
      allocation.type === 'BOOKING' ||
      allocation.type === 'VISIT_BOOKING'
    ) {
      const metaKey =
        allocation.type === 'SALE_INSTALLMENT'
          ? 'saleInstallmentId'
          : allocation.type === 'BOOKING'
            ? 'bookingId'
            : 'visitBookingId';
      return this.targetPropertyId(metaKey, allocation.refId);
    }
    return null;
  }

  private async targetPropertyId(
    key: 'rentScheduleId' | 'saleInstallmentId' | 'bookingId' | 'visitBookingId',
    id: string,
  ): Promise<string | null> {
    if (key === 'rentScheduleId') {
      const schedule = await this.prisma.rentSchedule.findUnique({
        where: { id },
        select: { lease: { select: { propertyId: true } } },
      });
      return schedule?.lease.propertyId ?? null;
    }
    if (key === 'saleInstallmentId') {
      const installment = await this.prisma.saleInstallment.findUnique({
        where: { id },
        select: { agreement: { select: { propertyId: true } } },
      });
      return installment?.agreement.propertyId ?? null;
    }
    if (key === 'bookingId') {
      const booking = await this.prisma.booking.findUnique({
        where: { id },
        select: { propertyId: true },
      });
      return booking?.propertyId ?? null;
    }
    const visit = await this.prisma.visitBooking.findUnique({
      where: { id },
      select: { propertyId: true },
    });
    return visit?.propertyId ?? null;
  }

  private toPublicRefund(refund: Refund): PublicRefund {
    return {
      id: refund.id,
      paymentId: refund.paymentId,
      amount: refund.amount.toString(),
      reason: refund.reason,
      status: refund.status,
      method: refund.method,
      providerRef: refund.providerRef,
      requestedById: refund.requestedById,
      approvedById: refund.approvedById,
      proofKey: refund.proofKey,
      failureReason: refund.failureReason,
      createdAt: refund.createdAt.toISOString(),
      processedAt: refund.processedAt?.toISOString() ?? null,
    };
  }

  private toPublicDispute(dispute: {
    id: string;
    paymentId: string;
    openedById: string;
    reason: string;
    description: string;
    evidenceKeys: string[];
    status: string;
    resolution: string | null;
    resolvedById: string | null;
    createdAt: Date;
    resolvedAt: Date | null;
  }): PublicDispute {
    return {
      id: dispute.id,
      paymentId: dispute.paymentId,
      openedById: dispute.openedById,
      reason: dispute.reason,
      description: dispute.description,
      evidenceKeys: dispute.evidenceKeys,
      status: dispute.status,
      resolution: dispute.resolution,
      resolvedById: dispute.resolvedById,
      createdAt: dispute.createdAt.toISOString(),
      resolvedAt: dispute.resolvedAt?.toISOString() ?? null,
    };
  }

  /**
   * `GET payments/my` — server-side pagination plus filters
   * (status, method, from, to). Returns `{ data, meta }` with
   * `meta: { total, page, pageSize, totalPages }`.
   *
   * `Payment` carries no `propertyId` column, so the optional property
   * filter is only honoured by the managed list below (portfolio scope).
   */
  async listMyPayments(
    userId: string,
    opts?: {
      page?: number;
      pageSize?: number;
      status?: PaymentStatus;
      method?: PaymentMethod;
      from?: Date;
      to?: Date;
    },
  ): Promise<{
    data: PublicPayment[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const page = Math.max(1, opts?.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts?.pageSize ?? 20));
    const where: Prisma.PaymentWhereInput = { userId };
    if (opts?.status) where.status = opts.status;
    if (opts?.method) where.method = opts.method;
    if (opts?.from) where.createdAt = { gte: opts.from };
    if (opts?.to) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter),
        lte: opts.to,
      };
    }
    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: { allocations: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data: rows.map((p) => this.toPublic(p)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
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
    const paymentIds = await this.collectManagedPaymentIds(userId);
    if (paymentIds.length === 0) return [];

    const rows = await this.prisma.payment.findMany({
      where: { id: { in: paymentIds } },
      include: { allocations: true },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((p) => this.toPublic(p));
  }

  /**
   * `GET payments/managed` — same portfolio scope as `listManaged` but with
   * server-side pagination and filters (status, method, propertyId, from,
   * to). Returns `{ data, meta }` with
   * `meta: { total, page, pageSize, totalPages }`.
   */
  async listManagedPayments(opts: {
    userId: string;
    page?: number;
    pageSize?: number;
    status?: PaymentStatus;
    method?: PaymentMethod;
    propertyId?: string;
    from?: Date;
    to?: Date;
  }): Promise<{
    data: PublicPayment[];
    meta: { total: number; page: number; pageSize: number; totalPages: number };
  }> {
    const page = Math.max(1, opts.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, opts.pageSize ?? 20));
    const paymentIds = await this.collectManagedPaymentIds(
      opts.userId,
      opts.propertyId,
    );
    if (paymentIds.length === 0) {
      return { data: [], meta: { total: 0, page, pageSize, totalPages: 1 } };
    }

    const where: Prisma.PaymentWhereInput = { id: { in: paymentIds } };
    if (opts.status) where.status = opts.status;
    if (opts.method) where.method = opts.method;
    if (opts.from) where.createdAt = { gte: opts.from };
    if (opts.to) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter),
        lte: opts.to,
      };
    }

    const [total, rows] = await Promise.all([
      this.prisma.payment.count({ where }),
      this.prisma.payment.findMany({
        where,
        include: { allocations: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return {
      data: rows.map((p) => this.toPublic(p)),
      meta: {
        total,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(total / pageSize) || 1),
      },
    };
  }

  /**
   * Ids of the payments visible on the caller's operable portfolio: payments
   * allocated to a schedule of a managed property, plus pending cash either
   * linked by `metadata.rentScheduleId` or paid by an ACTIVE tenant of a
   * managed property. When `propertyId` is given it narrows the portfolio to
   * that single property (caller must already be able to operate on it).
   */
  private async collectManagedPaymentIds(
    userId: string,
    propertyId?: string,
  ): Promise<string[]> {
    let propertyIds = await this.accessiblePropertyIds(userId);
    if (propertyId) {
      propertyIds = propertyIds.filter((id) => id === propertyId);
    }
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

    return Array.from(new Set([...allocatedIds, ...pendingIds]));
  }

  /**
   * `GET payments/managed/export.csv` — export plat (5000 lignes max) du
   * portefeuille géré, mêmes filtres que la liste paginée (spec 05 US 5).
   */
  async exportManagedCsv(
    userId: string,
    opts?: {
      status?: PaymentStatus;
      method?: PaymentMethod;
      propertyId?: string;
      from?: Date;
      to?: Date;
    },
  ): Promise<string> {
    const header = [
      'id',
      'createdAt',
      'userId',
      'amount',
      'currency',
      'method',
      'provider',
      'status',
      'reference',
      'providerRef',
      'validatedAt',
      'refundedAmount',
    ];
    const paymentIds = await this.collectManagedPaymentIds(
      userId,
      opts?.propertyId,
    );
    if (paymentIds.length === 0) return header.join(',');

    const where: Prisma.PaymentWhereInput = { id: { in: paymentIds } };
    if (opts?.status) where.status = opts.status;
    if (opts?.method) where.method = opts.method;
    if (opts?.from) where.createdAt = { gte: opts.from };
    if (opts?.to) {
      where.createdAt = {
        ...(where.createdAt as Prisma.DateTimeFilter),
        lte: opts.to,
      };
    }
    const rows = await this.prisma.payment.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });
    const lines = rows.map((r) =>
      [
        r.id,
        r.createdAt.toISOString(),
        r.userId,
        r.amount.toString(),
        r.currency,
        r.method,
        r.provider ?? '',
        r.status,
        r.reference,
        r.providerRef ?? '',
        r.validatedAt?.toISOString() ?? '',
        r.refundedAmount.toString(),
      ].join(','),
    );
    return [header.join(','), ...lines].join('\n');
  }

  /**
   * `GET payments/:id/timeline` — événements fournisseur, remboursements et
   * litiges du paiement (écran `payments/[id]`, spec 05 écrans).
   */
  async getTimeline(
    userId: string,
    paymentId: string,
  ): Promise<{
    events: Array<{
      id: string;
      provider: string;
      kind: string;
      payload: unknown;
      signatureValid: boolean | null;
      createdAt: string;
    }>;
    refunds: PublicRefund[];
    disputes: PublicDispute[];
  }> {
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

    const [events, refunds, disputes] = await Promise.all([
      this.prisma.paymentEvent.findMany({
        where: { paymentId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.refund.findMany({
        where: { paymentId },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.paymentDispute.findMany({
        where: { paymentId },
        orderBy: { createdAt: 'asc' },
      }),
    ]);
    return {
      events: events.map((e) => ({
        id: e.id,
        provider: e.provider,
        kind: e.kind,
        payload: e.payload,
        signatureValid: e.signatureValid,
        createdAt: e.createdAt.toISOString(),
      })),
      refunds: refunds.map((r) => this.toPublicRefund(r)),
      disputes: disputes.map((d) => this.toPublicDispute(d)),
    };
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

  /**
   * Spec 04 — keep `amountPaid` in sync and move the line to PARTIAL when a
   * payment lands on it, PAID once the balance reaches zero. A PARTIAL line
   * never gets a quittance (that is issued by `RentReceiptService` on PAID).
   *
   * Returns the ids of the schedules that just became fully paid so the
   * caller can issue their quittance outside the transaction. `DEPOSIT` lines
   * (the caution) are settled the same way but never produce a rent receipt.
   */
  private async maybeMarkRentSchedulePaid(
    tx: Prisma.TransactionClient,
    scheduleId: string,
  ): Promise<string[]> {
    const schedule = await tx.rentSchedule.findUnique({
      where: { id: scheduleId },
      include: { lease: { select: { id: true } } },
    });
    if (!schedule) return [];
    const totalAllocated = await tx.paymentAllocation.aggregate({
      where: { rentScheduleId: scheduleId },
      _sum: { amount: true },
    });
    const allocated = totalAllocated._sum.amount ?? new Prisma.Decimal(0);
    if (allocated.gte(schedule.amount)) {
      await tx.rentSchedule.update({
        where: { id: scheduleId },
        data: {
          status: RentScheduleStatus.PAID,
          amountPaid: allocated,
        },
      });
      return schedule.kind === RentScheduleKind.DEPOSIT ? [] : [scheduleId];
    }
    if (
      allocated.gt(new Prisma.Decimal(0)) &&
      (schedule.status === RentScheduleStatus.PENDING ||
        schedule.status === RentScheduleStatus.OVERDUE)
    ) {
      await tx.rentSchedule.update({
        where: { id: scheduleId },
        data: {
          status: RentScheduleStatus.PARTIAL,
          amountPaid: allocated,
        },
      });
    }
    return [];
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
      providerRef: p.providerRef,
      idempotencyKey: p.idempotencyKey,
      validatedBy: p.validatedBy,
      validatedAt: p.validatedAt?.toISOString() ?? null,
      bookingId: p.bookingId,
      payerPhone: p.payerPhone,
      expiresAt: p.expiresAt?.toISOString() ?? null,
      failureReason: p.failureReason,
      refundedAmount: p.refundedAmount.toString(),
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
