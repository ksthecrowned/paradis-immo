import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { RentScheduleStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
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
 *
 * Days are measured in *whole UTC days* between the two instants. A
 * schedule due in exactly 7 days → days = 7 → tier J-7.
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
 * Consumes a daily job (scheduled for 8am Africa/Brazzaville by the
 * repeatable job registered in `onModuleInit`) and emits rent
 * reminders for each `RentSchedule` whose dueDate falls on a reminder
 * day.
 *
 * Idempotency: a schedule is reminded at most once per tier. We check
 * the `Notification` table for a row of the matching type already
 * linked to this rentScheduleId before sending.
 */
@Injectable()
export class RentReminderProcessor implements OnModuleInit {
  private readonly logger = new Logger(RentReminderProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): Promise<void> {
    if (!process.env.REDIS_URL) {
      this.logger.warn(
        'REDIS_URL not set — skipping RENT_REMINDER_DAILY scheduler',
      );
      return Promise.resolve();
    }
    const u = new URL(process.env.REDIS_URL);
    const connection = {
      host: u.hostname || 'localhost',
      port: Number(u.port || 6379),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    };
    this.queue = new Queue(DOMAIN_EVENTS.RENT_REMINDER_DAILY, { connection });
    this.worker = new Worker(
      DOMAIN_EVENTS.RENT_REMINDER_DAILY,
      async () => this.runDaily(new Date()),
      { connection },
    );
    // 8am Africa/Brazzaville daily. Repeatable job is unique by name so
    // a re-registration replaces the existing schedule.
    void this.queue.add(
      'rent-reminder-daily',
      {},
      {
        repeat: { pattern: '0 8 * * *', tz: 'Africa/Brazzaville' },
        jobId: 'rent-reminder-daily',
      },
    );
    return Promise.resolve();
  }

  /**
   * Public for direct invocation from tests — no BullMQ dependency.
   * Scans every non-PAID RentSchedule and dispatches reminders for
   * the matching tier.
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
      // Idempotence: a notification of this exact type already exists
      // for this rentScheduleId → skip. We reach into the JSON payload
      // via a raw SQL fragment because Prisma's high-level `Json`
      // filters don't expose path-equality in 7.x reliably.
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
