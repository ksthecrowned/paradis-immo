import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RentScheduleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications.service';

/**
 * Rent reminder cadence. Each tier corresponds to a specific moment
 * relative to `dueDate`. The values are negative (days before due) or
 * positive (days after due). The matcher `pickTier` returns the FIRST
 * tier that the schedule falls into on the reference day.
 */
export const REMINDER_TIERS = [
  { days: -7, type: 'RENT_DUE_SOON' as const },
  { days: -3, type: 'RENT_DUE_SOON' as const },
  { days: -1, type: 'RENT_DUE_SOON' as const },
  { days: 0, type: 'RENT_DUE_SOON' as const },
  { days: 1, type: 'RENT_OVERDUE' as const },
  { days: 5, type: 'RENT_OVERDUE' as const },
  { days: 15, type: 'RENT_OVERDUE' as const },
];

export type ReminderType = 'RENT_DUE_SOON' | 'RENT_OVERDUE';

export interface ReminderTier {
  days: number;
  type: ReminderType;
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Pure helper — given a dueDate and a reference "now", return the
 * reminder tier that matches, or null if the schedule falls on no
 * reminder day.
 */
export function pickReminderTier(
  dueDate: Date,
  now: Date,
): ReminderTier | null {
  const dueUtc = Date.UTC(
    dueDate.getUTCFullYear(),
    dueDate.getUTCMonth(),
    dueDate.getUTCDate(),
  );
  const nowUtc = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  const days = Math.round((dueUtc - nowUtc) / DAY_MS);
  return REMINDER_TIERS.find((t) => t.days === days) ?? null;
}

/**
 * Daily job (8am Africa/Brazzaville) that emits rent reminders for each
 * `RentSchedule` whose dueDate falls on a reminder day.
 */
@Injectable()
export class RentReminderProcessor {
  private readonly logger = new Logger(RentReminderProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @Cron('0 8 * * *', { timeZone: 'Africa/Brazzaville' })
  async runScheduled(): Promise<void> {
    await this.runDaily(new Date());
  }

  /**
   * Public for direct invocation from tests.
   */
  async runDaily(
    now: Date,
    options: { leaseIds?: string[] } = {},
  ): Promise<{
    scanned: number;
    sent: number;
    overdueFlagged: number;
  }> {
    const schedules = await this.prisma.rentSchedule.findMany({
      where: {
        status: { not: RentScheduleStatus.PAID },
        ...(options.leaseIds ? { leaseId: { in: options.leaseIds } } : {}),
      },
      include: {
        lease: {
          select: {
            id: true,
            tenantId: true,
            property: { select: { title: true } },
          },
        },
      },
    });
    let sent = 0;
    let overdueFlagged = 0;
    for (const s of schedules) {
      const tier = pickReminderTier(s.dueDate, now);
      if (!tier) continue;
      const existing = await this.prisma.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM "Notification"
        WHERE type = ${tier.type}::text
          AND payload->>'rentScheduleId' = ${s.id}
        LIMIT 1
      `;
      if (existing.length > 0) continue;

      if (
        tier.type === 'RENT_OVERDUE' &&
        s.status === RentScheduleStatus.PENDING
      ) {
        await this.prisma.rentSchedule.update({
          where: { id: s.id },
          data: { status: RentScheduleStatus.OVERDUE },
        });
        overdueFlagged++;
      }

      await this.notifications.send({
        userId: s.lease.tenantId,
        channel: 'WHATSAPP',
        type: tier.type,
        payload: {
          rentScheduleId: s.id,
          dueDate: s.dueDate.toISOString(),
          amount: s.amount.toString(),
          currency: s.currency,
          propertyTitle: s.lease.property.title,
          ...(tier.days > 0 ? { daysOverdue: tier.days } : {}),
        },
      });
      sent++;
    }
    this.logger.log(
      `Rent reminder run: scanned=${schedules.length} sent=${sent} overdueFlagged=${overdueFlagged}`,
    );
    return { scanned: schedules.length, sent, overdueFlagged };
  }
}
