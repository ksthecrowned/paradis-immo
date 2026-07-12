import { Injectable } from '@nestjs/common';
import {
  LeaseStatus,
  PaymentStatus,
  PropertyStatus,
  VisitBookingStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface OwnerStats {
  activeProperties: number;
  activeLeases: number;
  pendingPayments: number;
  pendingVisitRequests: number;
}

@Injectable()
export class OwnerStatsService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(userId: string): Promise<OwnerStats> {
    const propertyScope = {
      OR: [
        { ownerId: userId },
        { organization: { members: { some: { userId } } } },
      ],
    };

    const [
      activeProperties,
      activeLeases,
      pendingPayments,
      pendingVisitRequests,
    ] = await Promise.all([
      this.prisma.property.count({
        where: { ...propertyScope, status: PropertyStatus.ACTIVE },
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
      this.prisma.visitBooking.count({
        where: {
          status: VisitBookingStatus.PENDING,
          property: propertyScope,
        },
      }),
    ]);

    return {
      activeProperties,
      activeLeases,
      pendingPayments,
      pendingVisitRequests,
    };
  }
}
