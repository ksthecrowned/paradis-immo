import { Injectable } from '@nestjs/common';
import {
  MaintenanceStatus,
  PaymentStatus,
  PropertyStatus,
  VisitBookingStatus,
} from '@prisma/client';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AgentStats {
  mandatedProperties: number;
  visitsToday: number;
  pendingCashValidations: number;
  openMaintenanceTickets: number;
}

const BRAZZAVILLE_TZ = 'Africa/Brazzaville';

/** Calendar-day bounds for Africa/Brazzaville (fixed UTC+1, no DST). */
export function brazzavilleDayBounds(now = new Date()): {
  start: Date;
  end: Date;
} {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: BRAZZAVILLE_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return {
    start: new Date(`${day}T00:00:00+01:00`),
    end: new Date(`${day}T23:59:59.999+01:00`),
  };
}

@Injectable()
export class AgentStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  async getStats(userId: string): Promise<AgentStats> {
    const propertyIds =
      await this.agencyAccess.listOperablePropertyIds(userId);
    if (propertyIds.length === 0) {
      return {
        mandatedProperties: 0,
        visitsToday: 0,
        pendingCashValidations: 0,
        openMaintenanceTickets: 0,
      };
    }

    const { start, end } = brazzavilleDayBounds();
    const propertyScope = { id: { in: propertyIds } };

    const [
      mandatedProperties,
      visitsToday,
      pendingCashValidations,
      openMaintenanceTickets,
    ] = await Promise.all([
      this.prisma.property.count({
        where: { ...propertyScope, status: PropertyStatus.ACTIVE },
      }),
      this.prisma.visitBooking.count({
        where: {
          propertyId: { in: propertyIds },
          status: {
            in: [VisitBookingStatus.PENDING, VisitBookingStatus.CONFIRMED],
          },
          slot: { startAt: { gte: start, lte: end } },
        },
      }),
      this.countPendingCashOnPortfolio(propertyIds),
      this.prisma.maintenanceTicket.count({
        where: {
          propertyId: { in: propertyIds },
          status: {
            in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS],
          },
        },
      }),
    ]);

    return {
      mandatedProperties,
      visitsToday,
      pendingCashValidations,
      openMaintenanceTickets,
    };
  }

  /**
   * Cash awaiting validation linked to the portfolio via rent-schedule
   * allocations or metadata.rentScheduleId (same idea as listManaged).
   */
  private async countPendingCashOnPortfolio(
    propertyIds: string[],
  ): Promise<number> {
    const leases = await this.prisma.lease.findMany({
      where: { propertyId: { in: propertyIds } },
      select: { id: true },
    });
    const leaseIds = leases.map((l) => l.id);
    if (leaseIds.length === 0) return 0;

    const schedules = await this.prisma.rentSchedule.findMany({
      where: { leaseId: { in: leaseIds } },
      select: { id: true },
    });
    const scheduleIds = schedules.map((s) => s.id);
    if (scheduleIds.length === 0) return 0;

    const scheduleIdSet = new Set(scheduleIds);

    const [allocated, pendingRows] = await Promise.all([
      this.prisma.payment.count({
        where: {
          method: 'CASH',
          status: PaymentStatus.PENDING_VALIDATION,
          allocations: {
            some: { rentScheduleId: { in: scheduleIds } },
          },
        },
      }),
      this.prisma.payment.findMany({
        where: {
          method: 'CASH',
          status: PaymentStatus.PENDING_VALIDATION,
          allocations: { none: {} },
        },
        select: { id: true, metadata: true },
        take: 500,
      }),
    ]);

    const metaLinked = pendingRows.filter((p) => {
      const meta = (p.metadata ?? {}) as { rentScheduleId?: unknown };
      return (
        typeof meta.rentScheduleId === 'string' &&
        scheduleIdSet.has(meta.rentScheduleId)
      );
    }).length;

    return allocated + metaLinked;
  }
}
