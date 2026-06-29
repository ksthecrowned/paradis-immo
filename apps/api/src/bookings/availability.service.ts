import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AvailabilityWindow {
  startDate: string;
  endDate: string;
  reason: string;
  refId: string | null;
}

@Injectable()
export class AvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List availability windows (`AvailabilityBlock` rows) for a property in a
   * given date range. The list mirrors the raw blocks — "free" days are
   * implicitly everything outside the returned ranges.
   */
  async listAvailability(
    propertyId: string,
    opts: { from?: Date; to?: Date } = {},
  ): Promise<AvailabilityWindow[]> {
    const rows = await this.prisma.availabilityBlock.findMany({
      where: {
        propertyId,
        ...(opts.from ? { endDate: { gte: opts.from } } : {}),
        ...(opts.to ? { startDate: { lte: opts.to } } : {}),
      },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((r) => ({
      startDate: r.startDate.toISOString(),
      endDate: r.endDate.toISOString(),
      reason: r.reason,
      refId: r.refId,
    }));
  }
}
