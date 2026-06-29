import { Injectable } from '@nestjs/common';
import { RentSchedule } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  generateRentSchedule,
  RentScheduleEntry,
  RentScheduleInput,
} from './rent-schedule.generator';

@Injectable()
export class RentScheduleGenerator {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Persist the rent schedule for a freshly-activated lease. Uses
   * `skipDuplicates: true` plus the `@@unique([leaseId, dueDate])` index so
   * re-runs are no-ops.
   */
  async generateForLease(
    leaseId: string,
    input: RentScheduleInput,
  ): Promise<RentSchedule[]> {
    const planned: RentScheduleEntry[] = generateRentSchedule(input);
    if (planned.length === 0) return [];

    await this.prisma.rentSchedule.createMany({
      data: planned.map((e) => ({
        leaseId,
        dueDate: e.dueDate,
        amount: e.amount,
        currency: e.currency,
      })),
      skipDuplicates: true,
    });

    return this.prisma.rentSchedule.findMany({
      where: { leaseId },
      orderBy: { dueDate: 'asc' },
    });
  }
}
