import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import {
  DepositDeductionStatus,
  Lease,
  LeaseStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  RentScheduleKind,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import type { CreateDeductionDto } from './dto/create-deduction.dto';
import type { UpdateDeductionDto } from './dto/update-deduction.dto';
import type { SettleDepositDto } from './dto/settle-deposit.dto';

/** Spec 04 — the tenant may contest a deduction for 15 days. */
export const DEPOSIT_CONTEST_DAYS = 15;
/** The refund is due at the latest 30 days after the exit inspection. */
export const DEPOSIT_REFUND_DEADLINE_DAYS = 30;
/** The manager is warned at J+25 (5 days before the legal deadline). */
export const DEPOSIT_REFUND_ALERT_DAYS = 25;

export interface PublicDepositDeduction {
  id: string;
  leaseId: string;
  label: string;
  amount: string;
  evidenceItemId: string | null;
  evidenceKeys: string[];
  status: string;
  tenantComment: string | null;
  createdAt: string;
  /** Last day the tenant can contest it (15 days after it was proposed). */
  contestableUntil: string;
  contestable: boolean;
}

export interface PublicDepositSettlement {
  id: string;
  leaseId: string;
  heldAmount: string;
  deducted: string;
  refundAmount: string;
  contestUntil: string;
  payoutId: string | null;
  settledAt: string | null;
}

export interface PublicDepositSummary {
  leaseId: string;
  leaseStatus: string;
  currency: string;
  /** Contractual deposit, i.e. what the tenant owes. */
  depositAmount: string;
  /** Actually collected on the `DEPOSIT` schedule line, 0 when unpaid. */
  heldAmount: string;
  schedule: {
    id: string;
    dueDate: string;
    amount: string;
    amountPaid: string;
    status: string;
  } | null;
  deductions: PublicDepositDeduction[];
  /** Sum of the ACCEPTED deductions. */
  deductedTotal: string;
  /** Sum of every non-accepted deduction (still open). */
  openTotal: string;
  settlement: PublicDepositSettlement | null;
  /** 30 days after the exit date, while the lease is closing. */
  refundDeadline: string | null;
}

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly events: EventPublisher,
  ) {}

  /** Spec 04 — deposit state of a lease: collected amount, deductions, refund. */
  async getSummary(userId: string, leaseId: string): Promise<PublicDepositSummary> {
    const lease = await this.requireLease(leaseId);
    await this.assertCanReadLease(userId, lease);
    return this.buildSummary(lease);
  }

  /**
   * Spec 04 — the manager records a deduction on the exit inspection. The sum
   * of every deduction (open or accepted) can never exceed the deposit held.
   */
  async proposeDeduction(
    managerId: string,
    leaseId: string,
    input: CreateDeductionDto,
  ): Promise<PublicDepositDeduction> {
    const lease = await this.requireLease(leaseId);
    await this.agencyAccess.assertCanOperateOnProperty(
      managerId,
      lease.propertyId,
    );
    this.assertLeaseIsClosing(lease.status);

    const held = this.heldAmount(lease.deposit);
    const already = await this.sumDeductions(leaseId);
    const total = already.add(new Prisma.Decimal(input.amount));
    if (total.gt(held)) {
      throw new BadRequestException({
        code: 'DEPOSIT_DEDUCTIONS_EXCEED_DEPOSIT',
        message: `Deductions (${total.toString()}) cannot exceed the deposit held (${held.toString()})`,
      });
    }

    const deduction = await this.prisma.depositDeduction.create({
      data: {
        leaseId,
        label: input.label,
        amount: new Prisma.Decimal(input.amount),
        evidenceItemId: input.evidenceItemId ?? null,
        evidenceKeys: input.evidenceKeys ?? [],
        status: DepositDeductionStatus.PROPOSED,
      },
    });

    await this.events.emit(DOMAIN_EVENTS.DEPOSIT_DEDUCTION_PROPOSED, {
      leaseId,
      deductionId: deduction.id,
      tenantId: lease.tenantId,
      label: deduction.label,
      amount: deduction.amount.toString(),
    });

    return this.toPublicDeduction(deduction);
  }

  /**
   * Spec 04 — `PATCH /deposit-deductions/:id`.
   *
   * The tenant contests (CONTESTED) within 15 days of the proposal; the
   * manager accepts it, including after a contestation, when settling.
   */
  async updateDeduction(
    actorId: string,
    deductionId: string,
    input: UpdateDeductionDto,
  ): Promise<PublicDepositDeduction> {
    const deduction = await this.prisma.depositDeduction.findUnique({
      where: { id: deductionId },
      include: { lease: { select: { id: true, propertyId: true, tenantId: true } } },
    });
    if (!deduction) {
      throw new NotFoundException({
        code: 'DEPOSIT_DEDUCTION_NOT_FOUND',
        message: 'Deposit deduction does not exist',
      });
    }
    const isTenant = deduction.lease.tenantId === actorId;

    if (!isTenant) {
      await this.agencyAccess.assertCanOperateOnProperty(
        actorId,
        deduction.lease.propertyId,
      );
      if (input.status !== DepositDeductionStatus.ACCEPTED) {
        throw new ForbiddenException({
          code: 'DEPOSIT_DEDUCTION_STATUS_FORBIDDEN',
          message:
            'A manager can only accept a deduction (status ACCEPTED); contesting is reserved to the tenant',
        });
      }
      if (
        deduction.status === DepositDeductionStatus.ACCEPTED
      ) {
        throw new ConflictException({
          code: 'DEPOSIT_DEDUCTION_ALREADY_ACCEPTED',
          message: 'This deduction is already accepted',
        });
      }
    } else {
      if (input.status !== DepositDeductionStatus.CONTESTED) {
        throw new ForbiddenException({
          code: 'DEPOSIT_DEDUCTION_STATUS_FORBIDDEN',
          message:
            'A tenant can only contest a deduction (status CONTESTED)',
        });
      }
      if (!input.tenantComment || input.tenantComment.trim().length < 3) {
        throw new BadRequestException({
          code: 'DEPOSIT_CONTEST_COMMENT_REQUIRED',
          message: 'Explain the contestation in `tenantComment`',
        });
      }
      if (deduction.status !== DepositDeductionStatus.PROPOSED) {
        throw new ConflictException({
          code: 'DEPOSIT_DEDUCTION_NOT_CONTESTABLE',
          message: `Only a PROPOSED deduction can be contested (status: ${deduction.status})`,
        });
      }
      const until = this.contestableUntil(deduction.createdAt);
      if (new Date() > until) {
        throw new ConflictException({
          code: 'DEPOSIT_CONTEST_WINDOW_CLOSED',
          message: `Contestations are accepted for ${DEPOSIT_CONTEST_DAYS} days after the deduction was proposed`,
          details: { contestableUntil: until.toISOString() },
        });
      }
    }

    const updated = await this.prisma.depositDeduction.update({
      where: { id: deductionId },
      data: {
        status: input.status,
        ...(input.tenantComment !== undefined
          ? { tenantComment: input.tenantComment }
          : {}),
      },
    });

    if (input.status === DepositDeductionStatus.CONTESTED) {
      await this.events.emit(DOMAIN_EVENTS.DEPOSIT_DEDUCTION_CONTESTED, {
        leaseId: deduction.leaseId,
        deductionId: updated.id,
        tenantId: deduction.lease.tenantId,
        label: updated.label,
        amount: updated.amount.toString(),
        comment: updated.tenantComment,
      });
    }

    return this.toPublicDeduction(updated);
  }

  /**
   * Spec 04 — close the deposit: refund = deposit − ACCEPTED deductions, a
   * `DEPOSIT_OUT` ledger entry (owner side) and a payout to validate. The
   * money movement itself belongs to the payments spec (05).
   */
  async settleDeposit(
    managerId: string,
    leaseId: string,
    input: SettleDepositDto = {},
  ): Promise<PublicDepositSummary> {
    const lease = await this.requireLease(leaseId);
    await this.agencyAccess.assertCanOperateOnProperty(
      managerId,
      lease.propertyId,
    );
    this.assertLeaseIsClosing(lease.status);

    const existing = await this.prisma.depositSettlement.findUnique({
      where: { leaseId },
    });
    if (existing) {
      throw new ConflictException({
        code: 'DEPOSIT_ALREADY_SETTLED',
        message: 'The deposit of this lease is already settled',
        details: { settlementId: existing.id, refundAmount: existing.refundAmount.toString() },
      });
    }

    const held = this.heldAmount(lease.deposit);
    const accepted = await this.sumAcceptedDeductions(leaseId);
    if (accepted.gt(held)) {
      throw new BadRequestException({
        code: 'DEPOSIT_DEDUCTIONS_EXCEED_DEPOSIT',
        message: `Accepted deductions (${accepted.toString()}) cannot exceed the deposit held (${held.toString()})`,
      });
    }
    const refund = held.minus(accepted);
    const now = new Date();

    const { settlement, payout } = await this.prisma.$transaction(async (tx) => {
      const created = await tx.depositSettlement.create({
        data: {
          leaseId,
          heldAmount: held,
          deducted: accepted,
          refundAmount: refund,
          contestUntil: new Date(now.getTime() + DEPOSIT_CONTEST_DAYS * 86_400_000),
          settledAt: now,
        },
      });

      let payoutId: string | null = null;
      if (refund.gt(new Prisma.Decimal(0)) && lease.tenantId) {
        const payment = await tx.payment.create({
          data: {
            userId: lease.tenantId,
            amount: refund,
            currency: input.currency ?? lease.currency,
            method: (input.method ?? PaymentMethod.CASH) as PaymentMethod,
            status: PaymentStatus.PENDING_VALIDATION,
            reference: `deposit-refund-${created.id}`,
            idempotencyKey: `deposit-refund-${created.id}`,
            metadata: {
              type: 'DEPOSIT_REFUND',
              settlementId: created.id,
              leaseId,
              note: input.note ?? null,
            } as Prisma.InputJsonValue,
          },
        });
        payoutId = payment.id;
      }

      await tx.depositSettlement.update({
        where: { id: created.id },
        data: { payoutId },
      });

      const mandate = await tx.mandate.findFirst({
        where: {
          propertyId: lease.propertyId,
          OR: [
            { status: 'ACTIVE' },
            { status: 'TERMINATING', terminationEffectiveAt: { gt: now } },
          ],
        },
        select: { id: true, organizationId: true },
      });
      if (refund.gt(new Prisma.Decimal(0))) {
        // Spec 04 — the refund leaves the owner's books as a negative entry.
        await tx.ledgerEntry.create({
          data: {
            propertyId: lease.propertyId,
            mandateId: mandate?.id ?? null,
            ownerOrgId: lease.property.organizationId,
            agencyOrgId: mandate?.organizationId ?? null,
            type: 'DEPOSIT_OUT',
            amount: refund.neg(),
            currency: input.currency ?? lease.currency,
            sourceType: 'DEPOSIT_SETTLEMENT',
            sourceId: created.id,
            label: `Restitution de caution — ${lease.property.title}`,
            occurredAt: now,
          },
        });
      }

      return {
        settlement: { ...created, payoutId },
        payout: payoutId,
      };
    });

    await this.events.emit(DOMAIN_EVENTS.DEPOSIT_SETTLED, {
      leaseId,
      settlementId: settlement.id,
      tenantId: lease.tenantId,
      deducted: accepted.toString(),
      refundAmount: refund.toString(),
      currency: input.currency ?? lease.currency,
      payoutId: payout,
    });

    this.logger.log(
      `Deposit settled for lease ${leaseId}: deducted ${accepted.toString()}, refund ${refund.toString()}`,
    );
    return this.buildSummary(lease);
  }

  /**
   * Spec 04 — the refund is due within 30 days of the exit; the manager is
   * warned at J+25 on every closing lease that has no settlement yet.
   */
  @Cron('0 9 * * *', { timeZone: 'Africa/Brazzaville' })
  async alertRefundsDue(): Promise<number> {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const leases = await this.prisma.lease.findMany({
      where: {
        OR: [
          { status: LeaseStatus.TERMINATED },
          {
            status: LeaseStatus.TERMINATING,
            terminationEffectiveAt: { lte: now },
          },
        ],
        depositSettlement: null,
        tenantId: { not: null },
      },
      select: {
        id: true,
        tenantId: true,
        terminatedAt: true,
        terminationEffectiveAt: true,
        endDate: true,
        property: { select: { ownerId: true } },
      },
      take: 200,
    });

    let alerted = 0;
    for (const lease of leases) {
      const exitAt =
        lease.terminatedAt ?? lease.terminationEffectiveAt ?? lease.endDate;
      const deadline = new Date(
        exitAt.getTime() + DEPOSIT_REFUND_DEADLINE_DAYS * 86_400_000,
      );
      const alertAt = new Date(
        exitAt.getTime() + DEPOSIT_REFUND_ALERT_DAYS * 86_400_000,
      );
      if (now < alertAt) continue;

      // One alert per lease per day.
      const alreadyNotified = await this.prisma.notification.findFirst({
        where: {
          type: 'DEPOSIT_REFUND_DUE',
          createdAt: { gte: startOfDay },
          payload: { path: ['leaseId'], equals: lease.id },
        },
        select: { id: true },
      });
      if (alreadyNotified) continue;

      await this.events.emit(DOMAIN_EVENTS.DEPOSIT_REFUND_DUE, {
        leaseId: lease.id,
        tenantId: lease.tenantId,
        refundDeadline: deadline.toISOString(),
        ownerId: lease.property.ownerId,
      });
      alerted += 1;
    }
    return alerted;
  }

  private async buildSummary(
    lease: Lease & { property: { organizationId: string; title: string } },
  ): Promise<PublicDepositSummary> {
    const [schedule, deductions, settlement] = await Promise.all([
      this.prisma.rentSchedule.findFirst({
        where: { leaseId: lease.id, kind: RentScheduleKind.DEPOSIT },
        orderBy: { dueDate: 'asc' },
      }),
      this.prisma.depositDeduction.findMany({
        where: { leaseId: lease.id },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.depositSettlement.findUnique({ where: { leaseId: lease.id } }),
    ]);

    const deducted = deductions
      .filter((d) => d.status === DepositDeductionStatus.ACCEPTED)
      .reduce((acc, d) => acc.add(d.amount), new Prisma.Decimal(0));
    const open = deductions
      .filter((d) => d.status !== DepositDeductionStatus.ACCEPTED)
      .reduce((acc, d) => acc.add(d.amount), new Prisma.Decimal(0));

    const exitAt =
      lease.terminatedAt ?? lease.terminationEffectiveAt ?? lease.endDate;
    const closing = lease.status === LeaseStatus.TERMINATING ||
      lease.status === LeaseStatus.TERMINATED;

    return {
      leaseId: lease.id,
      leaseStatus: lease.status,
      currency: lease.currency,
      depositAmount: lease.deposit.toString(),
      heldAmount: schedule?.amountPaid.toString() ?? '0',
      schedule: schedule
        ? {
            id: schedule.id,
            dueDate: schedule.dueDate.toISOString(),
            amount: schedule.amount.toString(),
            amountPaid: schedule.amountPaid.toString(),
            status: schedule.status,
          }
        : null,
      deductions: deductions.map((d) => this.toPublicDeduction(d)),
      deductedTotal: deducted.toString(),
      openTotal: open.toString(),
      settlement: settlement
        ? {
            id: settlement.id,
            leaseId: settlement.leaseId,
            heldAmount: settlement.heldAmount.toString(),
            deducted: settlement.deducted.toString(),
            refundAmount: settlement.refundAmount.toString(),
            contestUntil: settlement.contestUntil.toISOString(),
            payoutId: settlement.payoutId,
            settledAt: settlement.settledAt?.toISOString() ?? null,
          }
        : null,
      refundDeadline: closing
        ? new Date(
            exitAt.getTime() + DEPOSIT_REFUND_DEADLINE_DAYS * 86_400_000,
          ).toISOString()
        : null,
    };
  }

  private toPublicDeduction(deduction: {
    id: string;
    leaseId: string;
    label: string;
    amount: Prisma.Decimal;
    evidenceItemId: string | null;
    evidenceKeys: string[];
    status: string;
    tenantComment: string | null;
    createdAt: Date;
  }): PublicDepositDeduction {
    const contestableUntil = this.contestableUntil(deduction.createdAt);
    return {
      id: deduction.id,
      leaseId: deduction.leaseId,
      label: deduction.label,
      amount: deduction.amount.toString(),
      evidenceItemId: deduction.evidenceItemId,
      evidenceKeys: deduction.evidenceKeys,
      status: deduction.status,
      tenantComment: deduction.tenantComment,
      createdAt: deduction.createdAt.toISOString(),
      contestableUntil: contestableUntil.toISOString(),
      contestable:
        deduction.status === DepositDeductionStatus.PROPOSED &&
        new Date() <= contestableUntil,
    };
  }

  private contestableUntil(createdAt: Date): Date {
    return new Date(createdAt.getTime() + DEPOSIT_CONTEST_DAYS * 86_400_000);
  }

  /** Sum of every deduction (open or accepted) on a lease. */
  private async sumDeductions(leaseId: string): Promise<Prisma.Decimal> {
    const agg = await this.prisma.depositDeduction.aggregate({
      where: { leaseId },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? new Prisma.Decimal(0);
  }

  private async sumAcceptedDeductions(
    leaseId: string,
  ): Promise<Prisma.Decimal> {
    const agg = await this.prisma.depositDeduction.aggregate({
      where: { leaseId, status: DepositDeductionStatus.ACCEPTED },
      _sum: { amount: true },
    });
    return agg._sum.amount ?? new Prisma.Decimal(0);
  }

  private heldAmount(deposit: Prisma.Decimal): Prisma.Decimal {
    return new Prisma.Decimal(deposit);
  }

  private assertLeaseIsClosing(status: LeaseStatus): void {
    if (
      status !== LeaseStatus.TERMINATING &&
      status !== LeaseStatus.TERMINATED
    ) {
      throw new ConflictException({
        code: 'LEASE_NOT_CLOSING',
        message: `Deductions and deposit settlement only apply to a closing lease (status: ${status})`,
      });
    }
  }

  private async requireLease(leaseId: string): Promise<
    Lease & {
      property: { organizationId: string; ownerId: string; title: string };
    }
  > {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: {
          select: { organizationId: true, ownerId: true, title: true },
        },
      },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    return lease;
  }

  private async assertCanReadLease(
    userId: string,
    lease: { propertyId: string; tenantId: string | null },
  ): Promise<void> {
    if (lease.tenantId === userId) return;
    await this.agencyAccess.assertCanOperateOnProperty(userId, lease.propertyId);
  }
}
