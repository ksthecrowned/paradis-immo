import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  PropertyReportReason,
  PropertyReportStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string | null,
    propertyId: string,
    reason: PropertyReportReason,
    description: string | undefined,
    deviceId: string | undefined,
  ): Promise<{ id: string; status: PropertyReportStatus }> {
    if (!userId && !deviceId) {
      throw new BadRequestException({
        code: 'DEVICE_ID_REQUIRED',
        message: 'Anonymous report requests must include a deviceId',
      });
    }

    const trimmed = description?.trim() || undefined;
    if (reason === 'OTHER' && !trimmed) {
      throw new BadRequestException({
        code: 'DESCRIPTION_REQUIRED',
        message: 'A description is required when reason is OTHER',
      });
    }

    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }

    const reporterKey = userId ? `user:${userId}` : `device:${deviceId}`;
    const existing = await this.prisma.propertyReport.findFirst({
      where: { propertyId, reporterKey, status: 'OPEN' },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException({
        code: 'REPORT_ALREADY_OPEN',
        message: 'You already have an open report for this property',
      });
    }

    const row = await this.prisma.propertyReport.create({
      data: {
        propertyId,
        reporterKey,
        reason,
        description: trimmed,
      },
      select: { id: true, status: true },
    });
    return row;
  }
}
