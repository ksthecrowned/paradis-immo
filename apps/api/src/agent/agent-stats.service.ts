import { Injectable } from '@nestjs/common';
import {
  ApplicationStatus,
  LeaseStatus,
  MaintenanceStatus,
  PaymentStatus,
  PropertyStatus,
  RentScheduleStatus,
  VisitBookingStatus,
} from '@prisma/client';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AgentStats {
  /** Biens ACTIVE du périmètre opérable (pas strictement « sous mandat »). */
  mandatedProperties: number;
  visitsToday: number;
  upcomingVisits: number;
  pendingCashValidations: number;
  openMaintenanceTickets: number;
  activeLeases: number;
  overdueSchedules: number;
  pendingApplications: number;
}

const BRAZZAVILLE_TZ = 'Africa/Brazzaville';

const EMPTY_STATS: AgentStats = {
  mandatedProperties: 0,
  visitsToday: 0,
  upcomingVisits: 0,
  pendingCashValidations: 0,
  openMaintenanceTickets: 0,
  activeLeases: 0,
  overdueSchedules: 0,
  pendingApplications: 0,
};

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
    const propertyIds = await this.agencyAccess.listOperablePropertyIds(userId);
    if (propertyIds.length === 0) {
      return { ...EMPTY_STATS };
    }

    const { start, end } = brazzavilleDayBounds();
    const weekEnd = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
    const propertyScope = { id: { in: propertyIds } };
    const visitStatuses = [
      VisitBookingStatus.PENDING,
      VisitBookingStatus.CONFIRMED,
    ];

    const [
      mandatedProperties,
      visitsToday,
      upcomingVisits,
      pendingCashValidations,
      openMaintenanceTickets,
      activeLeases,
      overdueSchedules,
      pendingApplications,
    ] = await Promise.all([
      this.prisma.property.count({
        where: { ...propertyScope, status: PropertyStatus.ACTIVE },
      }),
      this.prisma.visitBooking.count({
        where: {
          propertyId: { in: propertyIds },
          status: { in: visitStatuses },
          slot: { startAt: { gte: start, lte: end } },
        },
      }),
      this.prisma.visitBooking.count({
        where: {
          propertyId: { in: propertyIds },
          status: { in: visitStatuses },
          slot: { startAt: { gt: end, lt: weekEnd } },
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
      this.prisma.lease.count({
        where: {
          propertyId: { in: propertyIds },
          status: LeaseStatus.ACTIVE,
        },
      }),
      this.prisma.rentSchedule.count({
        where: {
          status: RentScheduleStatus.OVERDUE,
          lease: { propertyId: { in: propertyIds } },
        },
      }),
      this.prisma.rentalApplication.count({
        where: {
          propertyId: { in: propertyIds },
          status: {
            in: [
              ApplicationStatus.SUBMITTED,
              ApplicationStatus.UNDER_REVIEW,
              ApplicationStatus.SOLVENCY_PENDING,
            ],
          },
        },
      }),
    ]);

    return {
      mandatedProperties,
      visitsToday,
      upcomingVisits,
      pendingCashValidations,
      openMaintenanceTickets,
      activeLeases,
      overdueSchedules,
      pendingApplications,
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
