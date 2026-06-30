import { Injectable, NotFoundException } from '@nestjs/common';
import { PropertyStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  activeLeases: number;
  overdueSchedules: number;
  pendingRentSchedules: number;
  totalOrganizations: number;
}

export interface AdminUserRow {
  id: string;
  phone: string;
  name: string | null;
  countryId: string;
  roles: string[];
  createdAt: string;
}

export interface AdminUserListResult {
  data: AdminUserRow[];
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
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.property.count(),
      this.prisma.lease.count({ where: { status: 'ACTIVE' } }),
      this.prisma.rentSchedule.count({ where: { status: 'OVERDUE' } }),
      this.prisma.rentSchedule.count({ where: { status: 'PENDING' } }),
      this.prisma.organization.count(),
    ]);
    return {
      totalUsers,
      totalProperties,
      activeLeases,
      overdueSchedules,
      pendingRentSchedules,
      totalOrganizations,
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
}
