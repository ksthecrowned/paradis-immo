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
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';

export interface OwnerStats {
  activeProperties: number;
  draftProperties: number;
  activeLeases: number;
  pendingPayments: number;
  overdueSchedules: number;
  pendingVisitRequests: number;
  openMaintenanceTickets: number;
  pendingApplications: number;
}

const EMPTY_STATS: OwnerStats = {
  activeProperties: 0,
  draftProperties: 0,
  activeLeases: 0,
  pendingPayments: 0,
  overdueSchedules: 0,
  pendingVisitRequests: 0,
  openMaintenanceTickets: 0,
  pendingApplications: 0,
};

@Injectable()
export class OwnerStatsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

  async getStats(userId: string): Promise<OwnerStats> {
    const propertyIds = await this.agencyAccess.listOperablePropertyIds(userId);
    if (propertyIds.length === 0) {
      return { ...EMPTY_STATS };
    }

    const propertyScope = { id: { in: propertyIds } };

    const [
      activeProperties,
      draftProperties,
      activeLeases,
      pendingPayments,
      overdueSchedules,
      pendingVisitRequests,
      openMaintenanceTickets,
      pendingApplications,
    ] = await Promise.all([
      this.prisma.property.count({
        where: { ...propertyScope, status: PropertyStatus.ACTIVE },
      }),
      this.prisma.property.count({
        where: { ...propertyScope, status: PropertyStatus.DRAFT },
      }),
      this.prisma.lease.count({
        where: {
          status: LeaseStatus.ACTIVE,
          property: propertyScope,
        },
      }),
      this.prisma.payment.count({
        where: {
          status: {
            in: [PaymentStatus.INITIATED, PaymentStatus.PENDING_VALIDATION],
          },
          allocations: {
            some: {
              rentSchedule: { lease: { property: propertyScope } },
            },
          },
        },
      }),
      this.prisma.rentSchedule.count({
        where: {
          status: RentScheduleStatus.OVERDUE,
          lease: { property: propertyScope },
        },
      }),
      this.prisma.visitBooking.count({
        where: {
          status: VisitBookingStatus.PENDING,
          property: propertyScope,
        },
      }),
      this.prisma.maintenanceTicket.count({
        where: {
          propertyId: { in: propertyIds },
          status: {
            in: [MaintenanceStatus.OPEN, MaintenanceStatus.IN_PROGRESS],
          },
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
      activeProperties,
      draftProperties,
      activeLeases,
      pendingPayments,
      overdueSchedules,
      pendingVisitRequests,
      openMaintenanceTickets,
      pendingApplications,
    };
  }
}
