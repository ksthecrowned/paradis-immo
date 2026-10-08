import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  LeaseStatus,
  NotificationChannel,
  Prisma,
  RentScheduleKind,
  RentScheduleStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { ArrearsQueryDto, SendReminderDto } from './dto/arrears.dto';

const DAY_MS = 86_400_000;

/** Arrears buckets, spec 04 US 20 (0-30 j, 31-60 j, plus de 60 j). */
export const ARREARS_BUCKETS = [
  { key: 'd0_30', min: 1, max: 30, label: '0-30 jours' },
  { key: 'd31_60', min: 31, max: 60, label: '31-60 jours' },
  { key: 'd60plus', min: 61, max: Number.MAX_SAFE_INTEGER, label: '+ de 60 jours' },
] as const;

export type ArrearsBucketKey = (typeof ARREARS_BUCKETS)[number]['key'];

/** Public filter values (`?bucket=`) mapped to the internal bucket keys. */
const BUCKET_FILTERS: Record<string, ArrearsBucketKey> = {
  '0-30': 'd0_30',
  '31-60': 'd31_60',
  '60+': 'd60plus',
};

export interface ArrearsBuckets {
  d0_30: string;
  d31_60: string;
  d60plus: string;
}

export interface ArrearsRow {
  leaseId: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  currency: string;
  /** Unpaid amount past its due date. */
  overdueAmount: string;
  overdueCount: number;
  oldestDueDate: string | null;
  maxDaysOverdue: number;
  buckets: ArrearsBuckets;
  counts: Record<ArrearsBucketKey, number>;
}

export interface ArrearsSummary {
  leaseCount: number;
  /** Overdue per currency — a portfolio can span several countries. */
  totalOverdueByCurrency: Record<string, string>;
  buckets: Record<string, ArrearsBuckets>;
  currency: string;
}

export interface LeaseBalanceLine {
  id: string;
  dueDate: string;
  kind: string;
  amount: string;
  amountPaid: string;
  balance: string;
  status: string;
  /** Days past due, 0 when not due yet. */
  daysOverdue: number;
}

export interface LeaseBalance {
  leaseId: string;
  leaseStatus: string;
  currency: string;
  /** Collected on the `DEPOSIT` schedule line. */
  depositHeld: string;
  totalDue: string;
  totalPaid: string;
  /** Still owed on every non-cancelled line. */
  balance: string;
  overdueAmount: string;
  overdueCount: number;
  /** Oldest unpaid line past its due date, drives the formal notice. */
  oldestDueDate: string | null;
  nextDueDate: string | null;
  nextDueAmount: string | null;
  lines: LeaseBalanceLine[];
}

type OverdueLine = {
  leaseId: string;
  currency: string;
  dueDate: Date;
  amount: Prisma.Decimal;
  amountPaid: Prisma.Decimal;
};

/**
 * Spec 04 — unpaid rent: the arrears board bucketed by age, the balance of a
 * lease (parties) and the manual dunning message (manager).
 *
 * `DEPOSIT` lines are excluded from arrears on purpose: an unpaid deposit is
 * part of the deposit settlement, not of rent arrears.
 */
@Injectable()
export class ArrearsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
    private readonly notifications: NotificationsService,
    private readonly events: EventPublisher,
  ) {}

  /** GET /leases/arrears — one row per lease holding overdue rent. */
  async listArrears(
    userId: string,
    filter: ArrearsQueryDto,
  ): Promise<{
    data: ArrearsRow[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }> {
    const now = new Date();
    const rows = await this.buildRows(userId, filter, now);

    const bucketKey = filter.bucket
      ? BUCKET_FILTERS[filter.bucket]
      : undefined;
    const filtered = bucketKey
      ? rows.filter((row) => row.counts[bucketKey] > 0)
      : rows;
    const page = filter.page ?? 1;
    const pageSize = filter.pageSize ?? 20;
    const total = filtered.length;
    const start = (page - 1) * pageSize;

    return {
      data: filtered.slice(start, start + pageSize),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /** Totals per bucket for the board header. */
  async summary(userId: string, now = new Date()): Promise<ArrearsSummary> {
    const rows = await this.buildRows(userId, {}, now);
    const byCurrency: Record<string, string> = {};
    const buckets: Record<string, ArrearsBuckets> = {};
    let currency = 'XAF';

    for (const row of rows) {
      currency = row.currency;
      const current = new Prisma.Decimal(row.overdueAmount);
      byCurrency[row.currency] = new Prisma.Decimal(
        byCurrency[row.currency] ?? 0,
      )
        .add(current)
        .toString();
      const bucket = (buckets[row.currency] ??= {
        d0_30: '0',
        d31_60: '0',
        d60plus: '0',
      });
      for (const key of Object.keys(bucket) as ArrearsBucketKey[]) {
        bucket[key] = new Prisma.Decimal(bucket[key])
          .add(row.buckets[key])
          .toString();
      }
    }

    return {
      leaseCount: rows.length,
      totalOverdueByCurrency: byCurrency,
      buckets,
      currency,
    };
  }

  /** GET /leases/:id/balance — parties of the lease. */
  async getBalance(userId: string, leaseId: string): Promise<LeaseBalance> {
    const lease = await this.prisma.lease.findUnique({ where: { id: leaseId } });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    if (lease.tenantId !== userId) {
      await this.agencyAccess.assertCanOperateOnProperty(userId, lease.propertyId);
    }

    const now = new Date();
    const schedules = await this.prisma.rentSchedule.findMany({
      where: {
        leaseId,
        status: { not: RentScheduleStatus.CANCELLED },
      },
      orderBy: { dueDate: 'asc' },
    });

    let totalDue = new Prisma.Decimal(0);
    let totalPaid = new Prisma.Decimal(0);
    let overdueAmount = new Prisma.Decimal(0);
    let overdueCount = 0;
    let depositHeld = new Prisma.Decimal(0);
    let nextDueDate: Date | null = null;
    let nextDueAmount: Prisma.Decimal | null = null;
    let oldestDueDate: Date | null = null;

    const lines: LeaseBalanceLine[] = [];
    for (const s of schedules) {
      const balance = new Prisma.Decimal(s.amount).minus(s.amountPaid);
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - s.dueDate.getTime()) / DAY_MS),
      );
      totalDue = totalDue.add(s.amount);
      totalPaid = totalPaid.add(s.amountPaid);

      if (s.kind === RentScheduleKind.DEPOSIT) {
        depositHeld = s.amountPaid;
      } else {
        if (balance.gt(0) && daysOverdue > 0) {
          overdueAmount = overdueAmount.add(balance);
          overdueCount += 1;
          if (!oldestDueDate || s.dueDate < oldestDueDate) {
            oldestDueDate = s.dueDate;
          }
        }
        if (balance.gt(0) && s.dueDate >= now) {
          nextDueDate = nextDueDate ?? s.dueDate;
          nextDueAmount = (nextDueAmount ?? new Prisma.Decimal(0)).add(balance);
        }
      }

      lines.push({
        id: s.id,
        dueDate: s.dueDate.toISOString(),
        kind: s.kind,
        amount: s.amount.toString(),
        amountPaid: s.amountPaid.toString(),
        balance: balance.toString(),
        status: s.status,
        daysOverdue,
      });
    }

    return {
      leaseId,
      leaseStatus: lease.status,
      currency: lease.currency,
      depositHeld: depositHeld.toString(),
      totalDue: totalDue.toString(),
      totalPaid: totalPaid.toString(),
      balance: totalDue.minus(totalPaid).toString(),
      overdueAmount: overdueAmount.toString(),
      overdueCount,
      oldestDueDate: oldestDueDate?.toISOString() ?? null,
      nextDueDate: nextDueDate?.toISOString() ?? null,
      nextDueAmount: nextDueAmount?.toString() ?? null,
      lines,
    };
  }

  /**
   * POST /leases/:id/reminders — manual dunning message to the tenant on a
   * lease that actually owes rent. Rejected when there is nothing overdue, so
   * the manager never chases a tenant who is up to date.
   */
  async sendReminder(
    managerId: string,
    leaseId: string,
    input: SendReminderDto = {},
  ): Promise<{
    sent: boolean;
    channel: string;
    amount: string;
    currency: string;
    overdueCount: number;
    message: string;
  }> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      include: {
        property: { select: { title: true, organizationId: true } },
        tenant: { select: { name: true, phone: true } },
      },
    });
    if (!lease) {
      throw new NotFoundException({
        code: 'LEASE_NOT_FOUND',
        message: 'Lease does not exist',
      });
    }
    await this.agencyAccess.assertCanOperateOnProperty(
      managerId,
      lease.propertyId,
    );
    if (
      lease.status !== LeaseStatus.ACTIVE &&
      lease.status !== LeaseStatus.TERMINATING
    ) {
      throw new BadRequestException({
        code: 'LEASE_NOT_ACTIVE',
        message: `Reminders only apply to a running lease (status: ${lease.status})`,
      });
    }

    const balance = await this.getBalance(managerId, leaseId);
    if (balance.overdueCount === 0) {
      throw new BadRequestException({
        code: 'NO_OVERDUE_AMOUNT',
        message: 'This lease has no overdue rent — nothing to chase',
      });
    }

    const message =
      input.message ??
      `Paradis Immo — votre loyer de ${lease.property.title} est en retard : ${balance.overdueAmount} ${balance.currency} (${balance.overdueCount} échéance(s)). Merci de régulariser.`;

    let channel = input.channel ?? NotificationChannel.WHATSAPP;
    if (lease.tenantId) {
      channel =
        input.channel ??
        (await this.preferredChannel(lease.tenantId)) ??
        NotificationChannel.WHATSAPP;
      await this.notifications.send({
        userId: lease.tenantId,
        type: 'RENT_REMINDER_MANUAL',
        channel: channel as NotificationChannel,
        payload: {
          leaseId,
          propertyTitle: lease.property.title,
          amount: balance.overdueAmount,
          currency: balance.currency,
          overdueCount: balance.overdueCount,
          message,
        },
      });
    } else {
      // Only an invited phone: no account to push to.
      const phone = lease.invitedPhone;
      if (!phone) {
        throw new BadRequestException({
          code: 'TENANT_CONTACT_MISSING',
          message: 'The tenant has neither an account nor an invited phone',
        });
      }
      await this.notifications.sendToPhone(
        phone,
        'RENT_REMINDER_MANUAL',
        { leaseId, amount: balance.overdueAmount },
        message,
      );
    }

    await this.events.emit(DOMAIN_EVENTS.LEASE_REMINDER_SENT, {
      leaseId,
      propertyId: lease.propertyId,
      tenantId: lease.tenantId,
      amount: balance.overdueAmount,
      currency: balance.currency,
      overdueCount: balance.overdueCount,
      channel: String(channel),
    });

    return {
      sent: true,
      channel: String(channel),
      amount: balance.overdueAmount,
      currency: balance.currency,
      overdueCount: balance.overdueCount,
      message,
    };
  }

  /** Build one row per lease holding overdue rent, worst offender first. */
  private async buildRows(
    userId: string,
    filter: Pick<ArrearsQueryDto, 'propertyId'>,
    now: Date,
  ): Promise<ArrearsRow[]> {
    const propertyIds = await this.agencyAccess.listOperablePropertyIds(userId);
    if (propertyIds.length === 0) return [];
    const scoped = filter.propertyId
      ? propertyIds.filter((id) => id === filter.propertyId)
      : propertyIds;
    if (scoped.length === 0) return [];

    const leases = await this.prisma.lease.findMany({
      where: {
        propertyId: { in: scoped },
        status: { in: [LeaseStatus.ACTIVE, LeaseStatus.TERMINATING] },
      },
      select: {
        id: true,
        propertyId: true,
        tenantId: true,
        invitedPhone: true,
        currency: true,
        tenant: { select: { name: true, phone: true } },
        property: { select: { title: true } },
      },
    });
    if (leases.length === 0) return [];

    const lines = (await this.prisma.rentSchedule.findMany({
      where: {
        leaseId: { in: leases.map((l) => l.id) },
        status: {
          in: [
            RentScheduleStatus.PENDING,
            RentScheduleStatus.OVERDUE,
            RentScheduleStatus.PARTIAL,
          ],
        },
        kind: { not: RentScheduleKind.DEPOSIT },
        dueDate: { lt: now },
      },
      select: {
        leaseId: true,
        currency: true,
        dueDate: true,
        amount: true,
        amountPaid: true,
      },
    }));

    const byLease = new Map<string, ArrearsRow>();
    for (const lease of leases) {
      byLease.set(lease.id, {
        leaseId: lease.id,
        propertyId: lease.propertyId,
        propertyTitle: lease.property.title,
        tenantId: lease.tenantId,
        tenantName: lease.tenant?.name ?? null,
        tenantPhone: lease.tenant?.phone ?? lease.invitedPhone ?? null,
        currency: lease.currency,
        overdueAmount: '0',
        overdueCount: 0,
        oldestDueDate: null,
        maxDaysOverdue: 0,
        buckets: { d0_30: '0', d31_60: '0', d60plus: '0' },
        counts: { d0_30: 0, d31_60: 0, d60plus: 0 },
      });
    }

    for (const line of lines) {
      const row = byLease.get(line.leaseId);
      if (!row) continue;
      const balance = new Prisma.Decimal(line.amount).minus(line.amountPaid);
      if (balance.lte(0)) continue;
      const daysOverdue = Math.max(
        0,
        Math.floor((now.getTime() - line.dueDate.getTime()) / DAY_MS),
      );
      row.overdueAmount = new Prisma.Decimal(row.overdueAmount)
        .add(balance)
        .toString();
      row.overdueCount += 1;
      row.maxDaysOverdue = Math.max(row.maxDaysOverdue, daysOverdue);
      const oldest = row.oldestDueDate
        ? new Date(row.oldestDueDate)
        : line.dueDate;
      row.oldestDueDate = (oldest < line.dueDate ? oldest : line.dueDate)
        .toISOString();
      const bucket = ARREARS_BUCKETS.find(
        (b) => daysOverdue >= b.min && daysOverdue <= b.max,
      );
      if (bucket) {
        row.buckets[bucket.key] = new Prisma.Decimal(row.buckets[bucket.key])
          .add(balance)
          .toString();
        row.counts[bucket.key] += 1;
      }
    }

    return [...byLease.values()]
      .filter((row) => row.overdueCount > 0)
      .sort(
        (a, b) =>
          b.maxDaysOverdue - a.maxDaysOverdue ||
          Number(b.overdueAmount) - Number(a.overdueAmount),
      );
  }

  /**
   * Delivery channel for a manual reminder. `SMS` is not a delivery channel
   * in this platform (WhatsApp only), so it maps to WhatsApp.
   */
  private async preferredChannel(
    userId: string,
  ): Promise<'PUSH' | 'WHATSAPP'> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { notificationChannel: true },
    });
    if (user?.notificationChannel === NotificationChannel.PUSH) return 'PUSH';
    return NotificationChannel.WHATSAPP;
  }
}
