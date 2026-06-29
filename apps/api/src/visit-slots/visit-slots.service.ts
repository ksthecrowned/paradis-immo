import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  VisitSlot,
  VisitSlotSource,
  VisitSlotStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface PublicVisitSlotTemplate {
  id: string;
  propertyId: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  slotMinutes: number;
  active: boolean;
  createdAt: string;
}

export interface PublicVisitSlot {
  id: string;
  propertyId: string;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  createdAt: string;
}

@Injectable()
export class VisitSlotsService {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------
  // Templates CRUD
  // ------------------------------------------------------------------

  async createTemplate(
    userId: string,
    propertyId: string,
    input: {
      dayOfWeek: number;
      startTime: string;
      endTime: string;
      slotMinutes: number;
    },
  ): Promise<PublicVisitSlotTemplate> {
    this.assertTemplateInput(input);
    await this.assertCanManageProperty(userId, propertyId);

    const tpl = await this.prisma.visitSlotTemplate.create({
      data: {
        propertyId,
        dayOfWeek: input.dayOfWeek,
        startTime: input.startTime,
        endTime: input.endTime,
        slotMinutes: input.slotMinutes,
      },
    });
    return this.templateToPublic(tpl);
  }

  async listTemplates(
    userId: string,
    propertyId: string,
  ): Promise<PublicVisitSlotTemplate[]> {
    await this.assertCanReadProperty(userId, propertyId);
    const rows = await this.prisma.visitSlotTemplate.findMany({
      where: { propertyId },
      orderBy: [{ dayOfWeek: 'asc' }, { startTime: 'asc' }],
    });
    return rows.map((t) => this.templateToPublic(t));
  }

  async deactivateTemplate(
    userId: string,
    templateId: string,
  ): Promise<PublicVisitSlotTemplate> {
    const tpl = await this.prisma.visitSlotTemplate.findUnique({
      where: { id: templateId },
    });
    if (!tpl) {
      throw new NotFoundException({
        code: 'TEMPLATE_NOT_FOUND',
        message: 'Template does not exist',
      });
    }
    await this.assertCanManageProperty(userId, tpl.propertyId);
    const updated = await this.prisma.visitSlotTemplate.update({
      where: { id: templateId },
      data: { active: false },
    });
    return this.templateToPublic(updated);
  }

  // ------------------------------------------------------------------
  // Manual slots (BLOCKED)
  // ------------------------------------------------------------------

  async blockSlot(
    userId: string,
    propertyId: string,
    input: { startAt: Date; endAt: Date },
  ): Promise<PublicVisitSlot> {
    await this.assertCanManageProperty(userId, propertyId);
    if (input.endAt <= input.startAt) {
      throw new BadRequestException({
        code: 'INVALID_SLOT_RANGE',
        message: 'endAt must be after startAt',
      });
    }
    const created = await this.prisma.visitSlot.upsert({
      where: {
        propertyId_startAt: {
          propertyId,
          startAt: input.startAt,
        },
      },
      create: {
        propertyId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: VisitSlotStatus.BLOCKED,
        source: VisitSlotSource.MANUAL,
      },
      update: {
        status: VisitSlotStatus.BLOCKED,
        source: VisitSlotSource.MANUAL,
      },
    });
    return this.slotToPublic(created);
  }

  // ------------------------------------------------------------------
  // List available slots (public-ish)
  // ------------------------------------------------------------------

  async listAvailableSlots(
    propertyId: string,
    opts: { from?: Date; to?: Date } = {},
  ): Promise<PublicVisitSlot[]> {
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
    const rows = await this.prisma.visitSlot.findMany({
      where: {
        propertyId,
        status: VisitSlotStatus.AVAILABLE,
        ...(opts.from ? { startAt: { gte: opts.from } } : {}),
        ...(opts.to ? { endAt: { lte: opts.to } } : {}),
      },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((s) => this.slotToPublic(s));
  }

  // ------------------------------------------------------------------
  // Internals
  // ------------------------------------------------------------------

  private assertTemplateInput(input: {
    dayOfWeek: number;
    startTime: string;
    endTime: string;
    slotMinutes: number;
  }): void {
    if (input.dayOfWeek < 0 || input.dayOfWeek > 6) {
      throw new BadRequestException({
        code: 'INVALID_DAY_OF_WEEK',
        message: 'dayOfWeek must be between 0 (Sun) and 6 (Sat)',
      });
    }
    if (
      !/^\d{2}:\d{2}$/.test(input.startTime) ||
      !/^\d{2}:\d{2}$/.test(input.endTime)
    ) {
      throw new BadRequestException({
        code: 'INVALID_TIME_FORMAT',
        message: 'startTime/endTime must be HH:mm',
      });
    }
    if (input.slotMinutes <= 0 || input.slotMinutes > 24 * 60) {
      throw new BadRequestException({
        code: 'INVALID_SLOT_MINUTES',
        message: 'slotMinutes must be between 1 and 1440',
      });
    }
    const [sh, sm] = input.startTime.split(':').map(Number);
    const [eh, em] = input.endTime.split(':').map(Number);
    if (eh * 60 + em <= sh * 60 + sm) {
      throw new BadRequestException({
        code: 'INVALID_TIME_RANGE',
        message: 'endTime must be after startTime',
      });
    }
  }

  private async assertCanReadProperty(
    _userId: string | null,
    propertyId: string,
  ): Promise<void> {
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
  }

  private async assertCanManageProperty(
    userId: string,
    propertyId: string,
  ): Promise<void> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { id: true, ownerId: true, organizationId: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (property.ownerId === userId) return;
    const membership = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: property.organizationId,
        },
      },
    });
    if (!membership) {
      throw new ForbiddenException({
        code: 'NOT_PROPERTY_OWNER',
        message:
          'Only the owner or a member of the managing org can manage visit slots',
      });
    }
  }

  private templateToPublic(
    t: Prisma.VisitSlotTemplateGetPayload<Record<string, never>>,
  ): PublicVisitSlotTemplate {
    return {
      id: t.id,
      propertyId: t.propertyId,
      dayOfWeek: t.dayOfWeek,
      startTime: t.startTime,
      endTime: t.endTime,
      slotMinutes: t.slotMinutes,
      active: t.active,
      createdAt: t.createdAt.toISOString(),
    };
  }

  private slotToPublic(s: VisitSlot): PublicVisitSlot {
    return {
      id: s.id,
      propertyId: s.propertyId,
      startAt: s.startAt.toISOString(),
      endAt: s.endAt.toISOString(),
      status: s.status,
      source: s.source,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
