import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { OrgMemberRole, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';

const DAY_MS = 86_400_000;
/** Days before the end date where the parties are alerted (spec 03 US 7). */
const EXPIRING_ALERT_DAYS = [45, 30];

/**
 * Spec 03 — fin de mandat :
 * - un mandat TERMINATING passe en TERMINATED une fois le préavis écoulé ;
 * - un mandat à durée déterminée sans renouvellement tacite passe en EXPIRED ;
 * - avec renouvellement tacite, les deux parties sont notifiées à J-45 et
 *   J-30 (dé-doublonnées) et le mandat reste actif.
 */
@Injectable()
export class MandateRenewalProcessor {
  private readonly logger = new Logger(MandateRenewalProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Africa/Brazzaville' })
  async handleDaily(): Promise<void> {
    const result = await this.runDaily();
    this.logger.log(
      `Mandats: ${result.terminated} terminé(s), ${result.expired} expiré(s), ${result.expiring} alerte(s) d'échéance`,
    );
  }

  /** Public for direct invocation from tests. */
  async runDaily(): Promise<{
    terminated: number;
    expired: number;
    expiring: number;
  }> {
    const now = new Date();

    // 1. Notice elapsed → TERMINATED.
    const due = await this.prisma.mandate.findMany({
      where: {
        status: 'TERMINATING',
        terminationEffectiveAt: { lte: now },
      },
      select: { id: true },
    });
    if (due.length) {
      await this.prisma.mandate.updateMany({
        where: { id: { in: due.map((d) => d.id) } },
        data: { status: 'TERMINATED' },
      });
    }

    // 2. Fixed-term without tacit renewal → EXPIRED.
    const expired = await this.prisma.mandate.updateMany({
      where: {
        status: 'ACTIVE',
        endDate: { not: null, lte: now },
        tacitRenewal: false,
      },
      data: { status: 'EXPIRED' },
    });

    // 3. Tacit renewal alerts at J-45 / J-30 (deduplicated per recipient).
    let expiring = 0;
    const horizon = new Date(now.getTime() + 46 * DAY_MS);
    const upcoming = await this.prisma.mandate.findMany({
      where: {
        status: 'ACTIVE',
        endDate: { not: null, gt: now, lte: horizon },
        tacitRenewal: true,
      },
      select: {
        id: true,
        endDate: true,
        organizationId: true,
        property: { select: { ownerId: true } },
      },
    });
    for (const mandate of upcoming) {
      const daysLeft = Math.ceil(
        ((mandate.endDate as Date).getTime() - now.getTime()) / DAY_MS,
      );
      if (!EXPIRING_ALERT_DAYS.includes(daysLeft)) continue;

      const gerants = await this.prisma.organizationMember.findMany({
        where: {
          organizationId: mandate.organizationId,
          role: OrgMemberRole.ADMIN,
        },
        select: { userId: true },
      });
      const recipients = [
        mandate.property.ownerId,
        ...gerants.map((g) => g.userId),
      ];
      for (const userId of recipients) {
        const already = await this.prisma.notification.count({
          where: {
            userId,
            type: 'MANDATE_EXPIRING',
            AND: [
              { payload: { path: ['mandateId'], equals: mandate.id } },
              { payload: { path: ['daysLeft'], equals: daysLeft } },
            ],
          },
        });
        if (already > 0) continue;
        await this.notifications.send({
          userId,
          type: 'MANDATE_EXPIRING',
          payload: {
            mandateId: mandate.id,
            daysLeft,
            endDate: (mandate.endDate as Date).toISOString(),
          },
        });
        expiring += 1;
      }
    }

    return {
      terminated: due.length,
      expired: expired.count,
      expiring,
    };
  }
}
