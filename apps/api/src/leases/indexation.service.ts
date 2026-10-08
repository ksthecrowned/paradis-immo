import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { LeaseStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { NotificationsService } from '../notifications/notifications.service';
import { MandateApprovalService } from '../mandates/mandate-approval.service';
import { AgencyAccessService } from '../mandates/agency-access.service';

const DAY_MS = 86_400_000;
/** The proposal is opened 30 days before the anniversary. */
export const INDEXATION_LEAD_DAYS = 30;

export interface IndexationRecord {
  id: string;
  actionType: 'RENT_INCREASE' | 'RENT_REDUCTION';
  status: string;
  previousMonthlyRent: string | null;
  newMonthlyRent: string | null;
  rate: string | null;
  /** Anniversary at which the new rent starts. */
  effectiveFrom: string | null;
  decidedAt: string | null;
  createdAt: string;
  expiresAt: string;
  appliedAt: string | null;
}

export interface IndexationProposal {
  leaseId: string;
  propertyId: string;
  anniversary: string;
  /** New rent = rent × (1 + indexationRate), rounded to 2 decimals. */
  newMonthlyRent: string;
  previousMonthlyRent: string;
  rate: string;
  actionType: 'RENT_INCREASE' | 'RENT_REDUCTION';
  /** Null when the property has no live mandate: the owner is told instead. */
  approvalId: string | null;
}

/**
 * Spec 04 US 8 — révision annuelle du loyer.
 *
 * Every year, 30 days before the lease anniversary, the contractual
 * `indexationRate` is applied to propose a new rent. Under a live mandate this
 * becomes a `RENT_INCREASE` / `RENT_REDUCTION` approval for the owner; without
 * a mandate the owner is notified directly. One proposal per anniversary.
 */
@Injectable()
export class IndexationService {
  private readonly logger = new Logger(IndexationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly notifications: NotificationsService,
    private readonly approvals: MandateApprovalService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  @Cron('0 6 * * *', { timeZone: 'Africa/Brazzaville' })
  async runScheduled(): Promise<void> {
    await this.proposeDueIndexations(new Date());
  }

  /** Public for direct invocation from tests. */
  async proposeDueIndexations(
    now = new Date(),
  ): Promise<IndexationProposal[]> {
    const horizon = new Date(
      now.getTime() + INDEXATION_LEAD_DAYS * DAY_MS,
    );
    const leases = await this.prisma.lease.findMany({
      where: {
        status: LeaseStatus.ACTIVE,
        indexationRate: { not: null },
        startDate: { lte: horizon },
      },
      select: {
        id: true,
        propertyId: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        currency: true,
        indexationRate: true,
        property: { select: { ownerId: true } },
      },
      take: 300,
    });

    const created: IndexationProposal[] = [];
    for (const lease of leases) {
      const anniversary = this.nextAnniversary(lease.startDate, lease.endDate, now, horizon);
      if (!anniversary) continue;
      if (await this.alreadyProposed(lease.id, anniversary)) continue;

      const rate = new Prisma.Decimal(lease.indexationRate ?? 0);
      const newRent = lease.monthlyRent
        .mul(rate.add(1))
        .toDecimalPlaces(2);
      // A zero or negative result is not a revision.
      if (newRent.lte(0) || newRent.eq(lease.monthlyRent)) continue;

      const actionType: 'RENT_INCREASE' | 'RENT_REDUCTION' =
        newRent.gt(lease.monthlyRent) ? 'RENT_INCREASE' : 'RENT_REDUCTION';

      const mandate = await this.liveMandate(lease.propertyId);
      let approvalId: string | null = null;
      if (mandate) {
        const approval = await this.approvals.requireApproval({
          mandateId: mandate.id,
          actionType,
          sourceType: 'LEASE',
          sourceId: lease.id,
          payload: {
            leaseId: lease.id,
            newMonthlyRent: newRent.toString(),
            previousMonthlyRent: lease.monthlyRent.toString(),
            effectiveFrom: anniversary.toISOString(),
            indexationRate: rate.toString(),
          },
          requestedByUserId: mandate.proposedById,
        });
        approvalId = approval.id;
      }

      await this.notifications.send({
        userId: lease.property.ownerId,
        type: 'RENT_INDEXATION_PROPOSED',
        payload: {
          leaseId: lease.id,
          propertyId: lease.propertyId,
          previousMonthlyRent: lease.monthlyRent.toString(),
          newMonthlyRent: newRent.toString(),
          currency: lease.currency,
          effectiveFrom: anniversary.toISOString(),
          approvalId,
        },
      });

      await this.events.emit(DOMAIN_EVENTS.RENT_INDEXATION_PROPOSED, {
        leaseId: lease.id,
        propertyId: lease.propertyId,
        ownerId: lease.property.ownerId,
        anniversary: anniversary.toISOString(),
        previousMonthlyRent: lease.monthlyRent.toString(),
        newMonthlyRent: newRent.toString(),
        currency: lease.currency,
        approvalId,
      });

      created.push({
        leaseId: lease.id,
        propertyId: lease.propertyId,
        anniversary: anniversary.toISOString(),
        newMonthlyRent: newRent.toString(),
        previousMonthlyRent: lease.monthlyRent.toString(),
        rate: rate.toString(),
        actionType,
        approvalId,
      });
    }

    if (created.length > 0) {
      this.logger.log(`Rent indexation: ${created.length} proposal(s)`);
    }
    return created;
  }

  /**
   * GET /leases/:id/indexations — the revision proposals opened on a lease,
   * most recent first. Each one is a `RENT_INCREASE` / `RENT_REDUCTION`
   * approval waiting for (or having received) the owner's decision.
   */
  async listForLease(
    userId: string,
    leaseId: string,
  ): Promise<IndexationRecord[]> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { id: true, propertyId: true, tenantId: true },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    if (lease.tenantId !== userId) {
      await this.agencyAccess.assertCanOperateOnProperty(userId, lease.propertyId);
    }

    const rows = await this.prisma.mandateApproval.findMany({
      where: {
        sourceType: 'LEASE',
        sourceId: leaseId,
        actionType: { in: ['RENT_INCREASE', 'RENT_REDUCTION'] },
      },
      select: {
        id: true,
        actionType: true,
        status: true,
        payload: true,
        decidedAt: true,
        decidedBy: true,
        createdAt: true,
        expiresAt: true,
        appliedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return rows.map((row) => {
      const payload = row.payload as {
        previousMonthlyRent?: string;
        newMonthlyRent?: string;
        effectiveFrom?: string;
        indexationRate?: string;
      } | null;
      return {
        id: row.id,
        actionType: row.actionType as 'RENT_INCREASE' | 'RENT_REDUCTION',
        status: row.status,
        previousMonthlyRent: payload?.previousMonthlyRent ?? null,
        newMonthlyRent: payload?.newMonthlyRent ?? null,
        rate: payload?.indexationRate ?? null,
        effectiveFrom: payload?.effectiveFrom ?? null,
        decidedAt: row.decidedAt ? row.decidedAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
        expiresAt: row.expiresAt.toISOString(),
        appliedAt: row.appliedAt ? row.appliedAt.toISOString() : null,
      };
    });
  }

  /**
   * First anniversary falling inside `[now, horizon]`, anniversary being
   * `startDate + n years`. Null when the lease ends before it.
   */
  private nextAnniversary(
    startDate: Date,
    endDate: Date,
    now: Date,
    horizon: Date,
  ): Date | null {
    for (let year = 1; year <= 10; year += 1) {
      const candidate = new Date(startDate);
      candidate.setUTCFullYear(candidate.getUTCFullYear() + year);
      if (candidate <= now) continue;
      if (candidate > horizon) return null;
      if (candidate > endDate) return null;
      return candidate;
    }
    return null;
  }

  /** One proposal per (lease, anniversary), pending or already decided. */
  private async alreadyProposed(
    leaseId: string,
    effectiveFrom: Date,
  ): Promise<boolean> {
    const rows = await this.prisma.mandateApproval.findMany({
      where: {
        actionType: { in: ['RENT_INCREASE', 'RENT_REDUCTION'] },
        status: { not: 'EXPIRED' },
      },
      select: { payload: true },
      take: 1000,
    });
    return rows.some((row) => {
      const payload = row.payload as {
        leaseId?: string;
        effectiveFrom?: string;
      } | null;
      if (payload?.leaseId !== leaseId) return false;
      const date = new Date(String(payload.effectiveFrom ?? ''));
      return date.toDateString() === effectiveFrom.toDateString();
    });
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
      select: { id: true, proposedById: true },
    });
  }
}
