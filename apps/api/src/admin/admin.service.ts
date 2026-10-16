import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PropertyReportStatus,
  PropertyStatus,
  UserStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AuditLogService } from '../common/audit-log.service';

export type AdminStatsRange = '1m' | '6m' | '1y';

export interface AdminActivitySeries {
  categories: string[];
  users: number[];
  properties: number[];
  paymentVolume: number[];
  paymentCounts: number[];
}

export interface AdminStatsCharts {
  range: AdminStatsRange;
  propertiesByMode: {
    rentShort: number;
    rentLong: number;
    sale: number;
  };
  activity: AdminActivitySeries;
}

export interface AdminStats {
  totalUsers: number;
  suspendedUsers: number;
  totalProperties: number;
  activeProperties: number;
  activeLeases: number;
  totalOrganizations: number;
  overdueSchedules: number;
  pendingRentSchedules: number;
  openReports: number;
  pendingOrgRequests: number;
  pendingKyc: number;
  pendingPaymentValidations: number;
  openDisputes: number;
  failedPayouts: number;
  pendingVisits: number;
  charts: AdminStatsCharts;
}

const MONTH_SHORT_FR = [
  'Jan',
  'Fév',
  'Mar',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Aoû',
  'Sep',
  'Oct',
  'Nov',
  'Déc',
] as const;

export interface AdminUserRow {
  id: string;
  phone: string | null;
  name: string | null;
  avatarUrl: string | null;
  countryName: string;
  status: UserStatus;
  roles: string[];
  createdAt: string;
}

export interface AdminUserDetail extends AdminUserRow {
  email: string | null;
  kycStatus: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
}

export interface AdminUserListResult {
  data: AdminUserRow[];
  meta: { total: number; page: number; pageSize: number };
}

export interface AdminModerationPropertyRow {
  id: string;
  title: string;
  mode: string;
  status: PropertyStatus;
  ownerId: string;
  owner: {
    id: string;
    name: string | null;
    avatarUrl: string | null;
  };
}

export interface AdminReportRow {
  id: string;
  propertyId: string;
  propertyTitle: string;
  reason: string;
  description: string | null;
  status: PropertyReportStatus;
  reporterKey: string;
  adminNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface AdminReportDetail extends AdminReportRow {
  property: {
    id: string;
    title: string;
    status: PropertyStatus;
    mode: string;
    address: string;
    quartierName: string | null;
    owner: {
      id: string;
      name: string | null;
      phone: string | null;
    };
  };
}

export interface AdminReportListResult {
  data: AdminReportRow[];
  meta: { total: number; page: number; pageSize: number };
}

/**
 * Back-office service. All read/write paths here bypass the per-tenant
 * scoping applied by `PropertiesService` / `LeasesService` because
 * PLATFORM_ADMIN is meant to see the entire fleet.
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly audit: AuditLogService,
  ) {}

  /** Spec 15 A3 — suspension/levée de suspension utilisateur auditée. */
  async auditSuspension(
    adminUserId: string,
    targetUserId: string,
    action: 'SUSPEND' | 'UNSUSPEND',
    reason?: string,
  ): Promise<void> {
    await this.audit.record({
      actorId: adminUserId,
      action: `admin.user.${action.toLowerCase()}`,
      targetType: 'USER',
      targetId: targetUserId,
      metadata: reason ? { reason } : undefined,
    });
  }

  /**
   * Aggregated counters + chart series for the admin dashboard.
   * Counters are indexed counts; series use date_trunc buckets.
   */
  async getStats(range: AdminStatsRange = '1y'): Promise<AdminStats> {
    const [
      totalUsers,
      suspendedUsers,
      totalProperties,
      activeProperties,
      activeLeases,
      totalOrganizations,
      overdueSchedules,
      pendingRentSchedules,
      openReports,
      pendingOrgRequests,
      pendingKyc,
      pendingPaymentValidations,
      openDisputes,
      failedPayouts,
      pendingVisits,
      modeGroups,
      charts,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { status: 'SUSPENDED' } }),
      this.prisma.property.count(),
      this.prisma.property.count({ where: { status: 'ACTIVE' } }),
      this.prisma.lease.count({ where: { status: 'ACTIVE' } }),
      this.prisma.organization.count(),
      this.prisma.rentSchedule.count({ where: { status: 'OVERDUE' } }),
      this.prisma.rentSchedule.count({ where: { status: 'PENDING' } }),
      this.prisma.propertyReport.count({ where: { status: 'OPEN' } }),
      this.prisma.organizationRequest.count({ where: { status: 'PENDING' } }),
      this.prisma.user.count({ where: { kycStatus: 'PENDING' } }),
      this.prisma.payment.count({
        where: { status: 'PENDING_VALIDATION' },
      }),
      this.prisma.paymentDispute.count({
        where: {
          status: { in: ['OPEN', 'AWAITING_MANAGER', 'ESCALATED'] },
        },
      }),
      this.prisma.payout.count({ where: { status: 'FAILED' } }),
      this.prisma.visitBooking.count({ where: { status: 'PENDING' } }),
      this.prisma.property.groupBy({
        by: ['mode'],
        _count: { _all: true },
      }),
      this.buildActivityCharts(range),
    ]);

    const modeCount = (mode: string): number =>
      modeGroups.find((g) => g.mode === mode)?._count._all ?? 0;

    return {
      totalUsers,
      suspendedUsers,
      totalProperties,
      activeProperties,
      activeLeases,
      totalOrganizations,
      overdueSchedules,
      pendingRentSchedules,
      openReports,
      pendingOrgRequests,
      pendingKyc,
      pendingPaymentValidations,
      openDisputes,
      failedPayouts,
      pendingVisits,
      charts: {
        range,
        propertiesByMode: {
          rentShort: modeCount('RENT_SHORT'),
          rentLong: modeCount('RENT_LONG'),
          sale: modeCount('SALE'),
        },
        activity: charts,
      },
    };
  }

  private async buildActivityCharts(
    range: AdminStatsRange,
    now = new Date(),
  ): Promise<AdminActivitySeries> {
    const trunc = range === '1m' ? 'week' : 'month';
    const buckets = this.activityBuckets(range, now);
    const from = buckets[0]?.start ?? now;

    type CountRow = { bucket: Date; count: bigint };
    type PayRow = { bucket: Date; count: bigint; amount: unknown };

    const [userRows, propertyRows, paymentRows] =
      trunc === 'week'
        ? await Promise.all([
            this.prisma.$queryRaw<CountRow[]>`
              SELECT date_trunc('week', "createdAt") AS bucket, COUNT(*)::bigint AS count
              FROM "User"
              WHERE "createdAt" >= ${from}
              GROUP BY 1
              ORDER BY 1
            `,
            this.prisma.$queryRaw<CountRow[]>`
              SELECT date_trunc('week', "createdAt") AS bucket, COUNT(*)::bigint AS count
              FROM "Property"
              WHERE "createdAt" >= ${from}
              GROUP BY 1
              ORDER BY 1
            `,
            this.prisma.$queryRaw<PayRow[]>`
              SELECT
                date_trunc('week', COALESCE("validatedAt", "createdAt")) AS bucket,
                COUNT(*)::bigint AS count,
                COALESCE(SUM("amount"), 0) AS amount
              FROM "Payment"
              WHERE status = 'VALIDATED'
                AND COALESCE("validatedAt", "createdAt") >= ${from}
              GROUP BY 1
              ORDER BY 1
            `,
          ])
        : await Promise.all([
            this.prisma.$queryRaw<CountRow[]>`
              SELECT date_trunc('month', "createdAt") AS bucket, COUNT(*)::bigint AS count
              FROM "User"
              WHERE "createdAt" >= ${from}
              GROUP BY 1
              ORDER BY 1
            `,
            this.prisma.$queryRaw<CountRow[]>`
              SELECT date_trunc('month', "createdAt") AS bucket, COUNT(*)::bigint AS count
              FROM "Property"
              WHERE "createdAt" >= ${from}
              GROUP BY 1
              ORDER BY 1
            `,
            this.prisma.$queryRaw<PayRow[]>`
              SELECT
                date_trunc('month', COALESCE("validatedAt", "createdAt")) AS bucket,
                COUNT(*)::bigint AS count,
                COALESCE(SUM("amount"), 0) AS amount
              FROM "Payment"
              WHERE status = 'VALIDATED'
                AND COALESCE("validatedAt", "createdAt") >= ${from}
              GROUP BY 1
              ORDER BY 1
            `,
          ]);

    const userMap = new Map(
      userRows.map((r) => [this.bucketKeyUtc(r.bucket, trunc), Number(r.count)]),
    );
    const propertyMap = new Map(
      propertyRows.map((r) => [
        this.bucketKeyUtc(r.bucket, trunc),
        Number(r.count),
      ]),
    );
    const paymentMap = new Map(
      paymentRows.map((r) => [
        this.bucketKeyUtc(r.bucket, trunc),
        {
          count: Number(r.count),
          amount: Math.round(Number(r.amount) || 0),
        },
      ]),
    );

    return {
      categories: buckets.map((b) => b.label),
      users: buckets.map((b) => userMap.get(b.key) ?? 0),
      properties: buckets.map((b) => propertyMap.get(b.key) ?? 0),
      paymentVolume: buckets.map((b) => paymentMap.get(b.key)?.amount ?? 0),
      paymentCounts: buckets.map((b) => paymentMap.get(b.key)?.count ?? 0),
    };
  }

  private activityBuckets(
    range: AdminStatsRange,
    now: Date,
  ): Array<{ key: string; label: string; start: Date }> {
    if (range === '1m') {
      const buckets: Array<{ key: string; label: string; start: Date }> = [];
      for (let i = 3; i >= 0; i -= 1) {
        const start = new Date(
          Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() - i * 7,
          ),
        );
        const dayNum = (start.getUTCDay() + 6) % 7;
        start.setUTCDate(start.getUTCDate() - dayNum);
        buckets.push({
          key: this.bucketKeyUtc(start, 'week'),
          label: `S${4 - i}`,
          start,
        });
      }
      return buckets;
    }

    const months = range === '6m' ? 6 : 12;
    const buckets: Array<{ key: string; label: string; start: Date }> = [];
    for (let i = months - 1; i >= 0; i -= 1) {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      buckets.push({
        key: this.bucketKeyUtc(start, 'month'),
        label: MONTH_SHORT_FR[start.getUTCMonth()] ?? '',
        start,
      });
    }
    return buckets;
  }

  /** Keys aligned with Postgres `date_trunc` results (UTC). */
  private bucketKeyUtc(value: Date, trunc: 'week' | 'month'): string {
    const d = new Date(value);
    if (trunc === 'month') {
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    }
    const day = new Date(
      Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()),
    );
    const dayNum = (day.getUTCDay() + 6) % 7;
    day.setUTCDate(day.getUTCDate() - dayNum);
    return day.toISOString().slice(0, 10);
  }

  /**
   * Paginated user list. We hydrate roles client-side via a second
   * query rather than a `include` because Prisma 7's nested
   * `select`-on-relation shape can produce surprising column widths.
   */
  async listUsers(
    page: number,
    pageSize: number,
  ): Promise<AdminUserListResult> {
    const skip = (page - 1) * pageSize;
    const [total, rows] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        select: {
          id: true,
          phone: true,
          name: true,
          avatarUrl: true,
          country: { select: { name: true } },
          status: true,
          createdAt: true,
          roles: { select: { role: true } },
        },
      }),
    ]);
    return {
      data: rows.map((u) => ({
        id: u.id,
        phone: u.phone,
        name: u.name,
        avatarUrl: u.avatarUrl,
        countryName: u.country.name,
        status: u.status,
        roles: u.roles.map((r) => r.role),
        createdAt: u.createdAt.toISOString(),
      })),
      meta: { total, page, pageSize },
    };
  }

  async getUserDetail(id: string): Promise<AdminUserDetail> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        phone: true,
        email: true,
        name: true,
        avatarUrl: true,
        country: { select: { name: true } },
        roles: { select: { role: true } },
        status: true,
        kycStatus: true,
        suspendedAt: true,
        suspendedReason: true,
        createdAt: true,
      },
    });
    if (!user) {
      throw new NotFoundException({
        code: 'USER_NOT_FOUND',
        message: `User ${id} not found`,
      });
    }
    return {
      id: user.id,
      phone: user.phone,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      countryName: user.country.name,
      roles: user.roles.map(({ role }) => role),
      status: user.status,
      kycStatus: user.kycStatus,
      suspendedAt: user.suspendedAt?.toISOString() ?? null,
      suspendedReason: user.suspendedReason,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async listPropertiesForModeration(
    limit: number,
  ): Promise<{ data: AdminModerationPropertyRow[]; total: number }> {
    const [properties, total] = await Promise.all([
      this.prisma.property.findMany({
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          mode: true,
          status: true,
          ownerId: true,
        },
      }),
      this.prisma.property.count(),
    ]);
    const owners = await this.prisma.user.findMany({
      where: {
        id: { in: [...new Set(properties.map(({ ownerId }) => ownerId))] },
      },
      select: { id: true, name: true, avatarUrl: true },
    });
    const ownersById = new Map(owners.map((owner) => [owner.id, owner]));

    return {
      data: properties.map((property) => ({
        ...property,
        owner: ownersById.get(property.ownerId) ?? {
          id: property.ownerId,
          name: null,
          avatarUrl: null,
        },
      })),
      total,
    };
  }

  /**
   * Moderate a property — flip its `status` to one of
   * `ACTIVE | PAUSED | ARCHIVED`. DRAFT is reserved for the owner
   * creation flow and is rejected explicitly.
   *
   * Returns the updated record (camelCased, with neighborhood
   * included) so the admin UI can update without a follow-up GET.
   */
  /**
   * Spec 15 A2 — la modération porte un motif obligatoire pour un refus,
   * et notifie le propriétaire (LISTING_MODERATED avec le motif).
   */
  async moderateProperty(
    id: string,
    target: PropertyStatus,
    adminUserId: string,
    reason?: string,
  ) {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: `Property ${id} not found`,
      });
    }
    // Spec 15 A2 — PropertyStatus n'a pas de REJECTED : le « refus »
    // correspond à ARCHIVED (retiré du marché) — le motif est obligatoire,
    // la notification porte ce motif.
    const isRejection = target === PropertyStatus.ARCHIVED;
    if (isRejection && !reason?.trim()) {
      throw new BadRequestException({
        code: 'MODERATION_REASON_REQUIRED',
        message: 'Un motif est requis pour refuser (ARCHIVED) une annonce',
      });
    }
    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: target },
    });

    await this.audit.record({
      actorId: adminUserId,
      action: 'admin.property.moderate',
      targetType: 'PROPERTY',
      targetId: id,
      before: { status: existing.status },
      after: { status: target },
      metadata: reason ? { reason } : undefined,
    });

    // Notifier le propriétaire avec le motif (12).
    await this.events.emit(DOMAIN_EVENTS.PROPERTY_MODERATED, {
      propertyId: id,
      ownerId: existing.ownerId,
      status: target,
      reason: reason ?? null,
      title: existing.title,
    });
    return updated;
  }

  /** Marketplace “mise en avant” — PLATFORM_ADMIN only. */
  async setPropertyFeatured(id: string, isFeatured: boolean) {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: `Property ${id} not found`,
      });
    }
    return this.prisma.property.update({
      where: { id },
      data: { isFeatured },
    });
  }

  async listReports(
    page: number,
    pageSize: number,
    status?: PropertyReportStatus,
  ): Promise<AdminReportListResult> {
    const skip = (page - 1) * pageSize;
    const where = status ? { status } : {};
    const [total, rows] = await Promise.all([
      this.prisma.propertyReport.count({ where }),
      this.prisma.propertyReport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: { property: { select: { title: true } } },
      }),
    ]);
    return {
      data: rows.map((r) => this.toReportRow(r)),
      meta: { total, page, pageSize },
    };
  }

  async getReport(id: string): Promise<AdminReportDetail> {
    const row = await this.prisma.propertyReport.findUnique({
      where: { id },
      include: {
        property: {
          select: {
            id: true,
            title: true,
            status: true,
            mode: true,
            address: true,
            ownerId: true,
            quartier: { select: { name: true } },
          },
        },
      },
    });
    if (!row) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: `Report ${id} not found`,
      });
    }
    const owner = await this.prisma.user.findUnique({
      where: { id: row.property.ownerId },
      select: { id: true, name: true, phone: true },
    });
    return {
      ...this.toReportRow(row),
      property: {
        id: row.property.id,
        title: row.property.title,
        status: row.property.status,
        mode: row.property.mode,
        address: row.property.address,
        quartierName: row.property.quartier?.name ?? null,
        owner: owner ?? {
          id: row.property.ownerId,
          name: null,
          phone: null,
        },
      },
    };
  }

  async updateReport(
    id: string,
    status: PropertyReportStatus,
    adminNote?: string,
  ): Promise<AdminReportRow> {
    const existing = await this.prisma.propertyReport.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException({
        code: 'REPORT_NOT_FOUND',
        message: `Report ${id} not found`,
      });
    }
    const updated = await this.prisma.propertyReport.update({
      where: { id },
      data: {
        status,
        adminNote: adminNote?.trim() || existing.adminNote,
        reviewedAt: status === 'OPEN' ? null : new Date(),
      },
      include: { property: { select: { title: true } } },
    });
    return this.toReportRow(updated);
  }

  private toReportRow(row: {
    id: string;
    propertyId: string;
    reason: string;
    description: string | null;
    status: PropertyReportStatus;
    reporterKey: string;
    adminNote: string | null;
    reviewedAt: Date | null;
    createdAt: Date;
    property: { title: string };
  }): AdminReportRow {
    return {
      id: row.id,
      propertyId: row.propertyId,
      propertyTitle: row.property.title,
      reason: row.reason,
      description: row.description,
      status: row.status,
      reporterKey: row.reporterKey,
      adminNote: row.adminNote,
      reviewedAt: row.reviewedAt?.toISOString() ?? null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
