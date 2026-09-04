import { Injectable, NotFoundException } from '@nestjs/common';
import {
  PropertyReportStatus,
  PropertyStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  activeLeases: number;
  overdueSchedules: number;
  pendingRentSchedules: number;
  totalOrganizations: number;
  openReports: number;
}

export interface AdminUserRow {
  id: string;
  phone: string | null;
  name: string | null;
  countryId: string;
  roles: string[];
  createdAt: string;
}

export interface AdminUserListResult {
  data: AdminUserRow[];
  meta: { total: number; page: number; pageSize: number };
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
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Aggregated counters shown on the admin dashboard.
   * Each count is a single indexed query — no joins — to stay snappy as
   * the dataset grows.
   */
  async getStats(): Promise<AdminStats> {
    const [
      totalUsers,
      totalProperties,
      activeLeases,
      overdueSchedules,
      pendingRentSchedules,
      totalOrganizations,
      openReports,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.property.count(),
      this.prisma.lease.count({ where: { status: 'ACTIVE' } }),
      this.prisma.rentSchedule.count({ where: { status: 'OVERDUE' } }),
      this.prisma.rentSchedule.count({ where: { status: 'PENDING' } }),
      this.prisma.organization.count(),
      this.prisma.propertyReport.count({ where: { status: 'OPEN' } }),
    ]);
    return {
      totalUsers,
      totalProperties,
      activeLeases,
      overdueSchedules,
      pendingRentSchedules,
      totalOrganizations,
      openReports,
    };
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
          countryId: true,
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
        countryId: u.countryId,
        roles: u.roles.map((r) => r.role),
        createdAt: u.createdAt.toISOString(),
      })),
      meta: { total, page, pageSize },
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
  async moderateProperty(id: string, target: PropertyStatus) {
    const existing = await this.prisma.property.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: `Property ${id} not found`,
      });
    }
    const updated = await this.prisma.property.update({
      where: { id },
      data: { status: target },
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
      data: rows.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        propertyTitle: r.property.title,
        reason: r.reason,
        description: r.description,
        status: r.status,
        reporterKey: r.reporterKey,
        adminNote: r.adminNote,
        reviewedAt: r.reviewedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
      meta: { total, page, pageSize },
    };
  }

  async updateReport(
    id: string,
    status: PropertyReportStatus,
    adminNote?: string,
  ) {
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
    return {
      id: updated.id,
      propertyId: updated.propertyId,
      propertyTitle: updated.property.title,
      reason: updated.reason,
      description: updated.description,
      status: updated.status,
      reporterKey: updated.reporterKey,
      adminNote: updated.adminNote,
      reviewedAt: updated.reviewedAt?.toISOString() ?? null,
      createdAt: updated.createdAt.toISOString(),
    };
  }
}
