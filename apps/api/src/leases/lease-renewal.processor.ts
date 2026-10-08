import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrgMemberRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { generateRentSchedule } from './rent-schedule.generator';

const DAY_MS = 86_400_000;
/** Spec 04 US 11 — alertes de fin de bail à J-90 et J-30. */
const RENEWAL_ALERT_DAYS = [90, 30];

/**
 * Spec 04 US 11 — à l'échéance d'un bail à durée déterminée :
 * - les deux parties sont alertées à J-90 et J-30 (dé-doublonnées), pour
 *   proposer le renouvellement (`POST /leases/:id/renew`) ;
 * - un bail `autoRenew` est renouvelé tacitement : le terme est prolongé d'un
 *   an, l'échéancier du nouveau terme est généré et les deux parties sont
 *   notifiées ;
 * - un bail sans renouvellement tacite ni renouvellement en attente d'approbation
 *   reste tel quel (la clôture passe par le congé / l'EDL de sortie).
 */
@Injectable()
export class LeaseRenewalProcessor {
  private readonly logger = new Logger(LeaseRenewalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly events: EventPublisher,
  ) {}

  @Cron('0 7 * * *', { timeZone: 'Africa/Brazzaville' })
  async handleDaily(): Promise<void> {
    const result = await this.runDaily();
    this.logger.log(
      `Baux: ${result.renewed} renouvellement(s) tacite(s), ${result.alerts} alerte(s) d'échéance`,
    );
  }

  /** Public for direct invocation from tests (optionally scoped). */
  async runDaily(
    now = new Date(),
    options: { leaseIds?: string[] } = {},
  ): Promise<{ renewed: number; alerts: number }> {
    return {
      renewed: await this.renewDueLeases(now, options),
      alerts: await this.sendExpiryAlerts(now, options),
    };
  }

  /** ACTIVE + autoRenew leases past their end date: extend by one year. */
  private async renewDueLeases(
    now: Date,
    options: { leaseIds?: string[] },
  ): Promise<number> {
    // A renewal waiting for the owner's decision must not race the tacit path.
    const pendingApprovals = await this.prisma.mandateApproval.findMany({
      where: { status: 'PENDING', actionType: { in: ['RENT_INCREASE', 'RENT_REDUCTION'] } },
      select: { payload: true },
    });
    const blocked = new Set(
      pendingApprovals
        .map((row) => String((row.payload as { leaseId?: string } | null)?.leaseId ?? ''))
        .filter(Boolean),
    );

    const due = await this.prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        autoRenew: true,
        endDate: { lt: now },
        ...(options.leaseIds ? { id: { in: options.leaseIds } } : {}),
      },
      select: {
        id: true,
        propertyId: true,
        tenantId: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        chargesAmount: true,
        dueDay: true,
        currency: true,
        property: { select: { ownerId: true } },
      },
      take: 100,
    });

    let renewed = 0;
    for (const lease of due) {
      if (blocked.has(lease.id)) continue;
      const newEndDate = addOneYear(lease.endDate);
      const updated = await this.prisma.lease.update({
        where: { id: lease.id },
        data: { endDate: newEndDate },
      });
      // Existing lines are kept (unique (leaseId, dueDate, kind) + skipDuplicates).
      const planned = generateRentSchedule({
        startDate: lease.startDate,
        endDate: updated.endDate,
        monthlyRent: lease.monthlyRent.toString(),
        chargesAmount: lease.chargesAmount.toString(),
        dueDay: lease.dueDay,
        currency: lease.currency,
      }).filter((entry) => entry.dueDate > lease.endDate);
      if (planned.length > 0) {
        await this.prisma.rentSchedule.createMany({
          data: planned.map((entry) => ({
            leaseId: lease.id,
            dueDate: entry.dueDate,
            kind: entry.kind,
            amount: entry.amount,
            currency: entry.currency,
            rentPart: entry.rentPart,
            chargesPart: entry.chargesPart,
            periodStart: entry.periodStart,
            periodEnd: entry.periodEnd,
          })),
          skipDuplicates: true,
        });
      }

      await this.events.emit(DOMAIN_EVENTS.LEASE_RENEWED, {
        leaseId: lease.id,
        propertyId: lease.propertyId,
        tenantId: lease.tenantId,
        previousEndDate: lease.endDate.toISOString(),
        newEndDate: updated.endDate.toISOString(),
        newMonthlyRent: lease.monthlyRent.toString(),
        approvalId: null,
      });

      const payload = {
        leaseId: lease.id,
        previousEndDate: lease.endDate.toISOString(),
        newEndDate: updated.endDate.toISOString(),
        tacit: true,
      };
      const recipients = new Set<string>();
      if (lease.tenantId) recipients.add(lease.tenantId);
      recipients.add(lease.property.ownerId);
      for (const userId of recipients) {
        await this.notifications.send({
          userId,
          type: 'LEASE_RENEWED',
          payload,
        });
      }
      renewed += 1;
    }
    return renewed;
  }

  /** Deduplicated J-90 / J-30 alerts to tenant, owner and agency gérants. */
  private async sendExpiryAlerts(
    now: Date,
    options: { leaseIds?: string[] },
  ): Promise<number> {
    const horizon = new Date(now.getTime() + 91 * DAY_MS);
    const upcoming = await this.prisma.lease.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { gt: now, lte: horizon },
        ...(options.leaseIds ? { id: { in: options.leaseIds } } : {}),
      },
      select: {
        id: true,
        endDate: true,
        autoRenew: true,
        tenantId: true,
        property: { select: { ownerId: true, organizationId: true } },
      },
      take: 300,
    });

    let alerts = 0;
    for (const lease of upcoming) {
      const daysLeft = Math.ceil(
        (lease.endDate.getTime() - now.getTime()) / DAY_MS,
      );
      if (!RENEWAL_ALERT_DAYS.includes(daysLeft)) continue;

      const recipients = new Set<string>();
      if (lease.tenantId) recipients.add(lease.tenantId);
      recipients.add(lease.property.ownerId);
      const gerants = await this.prisma.organizationMember.findMany({
        where: {
          organizationId: lease.property.organizationId,
          role: OrgMemberRole.ADMIN,
        },
        select: { userId: true },
      });
      for (const gerant of gerants) recipients.add(gerant.userId);

      for (const userId of recipients) {
        const already = await this.prisma.notification.count({
          where: {
            userId,
            type: 'LEASE_RENEWAL',
            AND: [
              { payload: { path: ['leaseId'], equals: lease.id } },
              { payload: { path: ['daysLeft'], equals: daysLeft } },
            ],
          },
        });
        if (already > 0) continue;
        await this.notifications.send({
          userId,
          type: 'LEASE_RENEWAL',
          payload: {
            leaseId: lease.id,
            daysLeft,
            endDate: lease.endDate.toISOString(),
            autoRenew: lease.autoRenew,
          },
        });
        alerts += 1;
      }
    }
    return alerts;
  }
}

function addOneYear(date: Date): Date {
  const out = new Date(date);
  out.setFullYear(out.getFullYear() + 1);
  return out;
}
