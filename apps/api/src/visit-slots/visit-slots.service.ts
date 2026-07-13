import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  VisitBooking,
  VisitBookingStatus,
  VisitSlot,
  VisitSlotSource,
  VisitSlotStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AgencyAccessService } from '../mandates/agency-access.service';

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

export interface PublicVisitBooking {
  id: string;
  slotId: string;
  propertyId: string;
  userId: string;
  status: string;
  paymentId: string | null;
  createdAt: string;
  slotStartAt?: string;
  slotEndAt?: string;
}

@Injectable()
export class VisitSlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly agencyAccess: AgencyAccessService,
  ) {}

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

  async openSlot(
    userId: string,
    propertyId: string,
    input: { startAt: Date; endAt: Date },
  ): Promise<PublicVisitSlot> {
    await this.assertCanManageProperty(userId, propertyId);
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { visitEnabled: true },
    });
    if (!property?.visitEnabled) {
      throw new BadRequestException({
        code: 'VISITS_DISABLED',
        message: 'Visits are not enabled for this property',
      });
    }
    if (input.endAt <= input.startAt) {
      throw new BadRequestException({
        code: 'INVALID_SLOT_RANGE',
        message: 'endAt must be after startAt',
      });
    }
    const existing = await this.prisma.visitSlot.findUnique({
      where: {
        propertyId_startAt: { propertyId, startAt: input.startAt },
      },
    });
    if (existing?.status === VisitSlotStatus.BOOKED) {
      throw new ConflictException({
        code: 'SLOT_BOOKED',
        message: 'Cannot open a slot that is already booked',
      });
    }
    const saved = await this.prisma.visitSlot.upsert({
      where: {
        propertyId_startAt: { propertyId, startAt: input.startAt },
      },
      create: {
        propertyId,
        startAt: input.startAt,
        endAt: input.endAt,
        status: VisitSlotStatus.AVAILABLE,
        source: VisitSlotSource.MANUAL,
      },
      update: {
        endAt: input.endAt,
        status: VisitSlotStatus.AVAILABLE,
        source: VisitSlotSource.MANUAL,
      },
    });
    return this.slotToPublic(saved);
  }

  async unblockSlot(
    userId: string,
    slotId: string,
  ): Promise<PublicVisitSlot> {
    const slot = await this.prisma.visitSlot.findUnique({
      where: { id: slotId },
    });
    if (!slot) {
      throw new NotFoundException({
        code: 'SLOT_NOT_FOUND',
        message: 'Visit slot does not exist',
      });
    }
    await this.assertCanManageProperty(userId, slot.propertyId);
    if (slot.status !== VisitSlotStatus.BLOCKED) {
      throw new BadRequestException({
        code: 'SLOT_NOT_BLOCKED',
        message: 'Only blocked slots can be unblocked',
      });
    }
    const updated = await this.prisma.visitSlot.update({
      where: { id: slotId },
      data: { status: VisitSlotStatus.AVAILABLE },
    });
    return this.slotToPublic(updated);
  }

  async listManagedSlots(
    userId: string,
    propertyId: string,
    opts: { from?: Date; to?: Date } = {},
  ): Promise<PublicVisitSlot[]> {
    await this.assertCanManageProperty(userId, propertyId);
    const from = opts.from ?? new Date();
    const rows = await this.prisma.visitSlot.findMany({
      where: {
        propertyId,
        startAt: { gte: from },
        ...(opts.to ? { endAt: { lte: opts.to } } : {}),
      },
      orderBy: { startAt: 'asc' },
    });
    return rows.map((s) => this.slotToPublic(s));
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
  // Bookings
  // ------------------------------------------------------------------

  /**
   * Book a visit slot. Free visits are confirmed immediately and the slot
   * is flipped to `BOOKED`. Paid visits create a `PENDING` booking and leave
   * the slot `AVAILABLE` until `confirmVisit()` is called (typically after a
   * payment is validated by the payments module).
   */
  async bookVisit(
    userId: string,
    input: { slotId: string; propertyId: string },
  ): Promise<PublicVisitBooking> {
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: { id: true, visitType: true, visitEnabled: true },
    });
    if (!property || !property.visitEnabled) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist or has no visits enabled',
      });
    }
    if (property.visitType !== 'FREE' && property.visitType !== 'PAID') {
      throw new BadRequestException({
        code: 'VISITS_DISABLED',
        message: 'This property does not accept visit bookings',
      });
    }

    const isFree = property.visitType === 'FREE';

    // Atomic transition: only an AVAILABLE slot can move to BOOKED.
    // For paid visits the slot stays AVAILABLE until payment is validated.
    let updatedCount = 1;
    if (isFree) {
      const updateResult = await this.prisma.visitSlot.updateMany({
        where: {
          id: input.slotId,
          propertyId: input.propertyId,
          status: VisitSlotStatus.AVAILABLE,
        },
        data: { status: VisitSlotStatus.BOOKED },
      });
      updatedCount = updateResult.count;
    }
    if (updatedCount === 0) {
      throw new ConflictException({
        code: 'SLOT_NOT_AVAILABLE',
        message: 'This slot is no longer available',
      });
    }

    try {
      const booking = await this.prisma.visitBooking.create({
        data: {
          slotId: input.slotId,
          propertyId: input.propertyId,
          userId,
          status: isFree
            ? VisitBookingStatus.CONFIRMED
            : VisitBookingStatus.PENDING,
        },
      });
      return this.bookingToPublic(booking);
    } catch (err) {
      if (isFree) {
        // Roll back the slot flip on failure.
        await this.prisma.visitSlot.updateMany({
          where: {
            id: input.slotId,
            status: VisitSlotStatus.BOOKED,
            booking: null,
          },
          data: { status: VisitSlotStatus.AVAILABLE },
        });
      }
      throw err;
    }
  }

  /**
   * Confirm a `PENDING` booking (used after a successful payment) and flip
   * the slot to `BOOKED`. Emits `VISIT_BOOKING_CONFIRMED`.
   */
  async confirmVisit(
    userId: string,
    bookingId: string,
  ): Promise<PublicVisitBooking> {
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { ownerId: true, organizationId: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Visit booking does not exist',
      });
    }
    await this.assertCanManageProperty(userId, booking.propertyId);

    if (booking.status !== VisitBookingStatus.PENDING) {
      throw new ConflictException({
        code: 'BOOKING_NOT_PENDING',
        message: `Cannot confirm a booking in status ${booking.status}`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.visitBooking.update({
        where: { id: bookingId },
        data: { status: VisitBookingStatus.CONFIRMED },
      });
      await tx.visitSlot.update({
        where: { id: booking.slotId },
        data: { status: VisitSlotStatus.BOOKED },
      });
      return b;
    });

    await this.events.emit(DOMAIN_EVENTS.VISIT_BOOKING_CONFIRMED, {
      bookingId: updated.id,
      slotId: updated.slotId,
      userId: updated.userId,
    });
    return this.bookingToPublic(updated);
  }

  /**
   * Cancel a booking. Either the tenant who created it or a property
   * manager (owner / org member) can cancel. Slot is freed.
   */
  async cancelVisit(
    userId: string,
    bookingId: string,
  ): Promise<PublicVisitBooking> {
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Visit booking does not exist',
      });
    }
    if (booking.userId !== userId) {
      await this.assertCanManageProperty(userId, booking.propertyId);
    }
    if (
      booking.status === VisitBookingStatus.CANCELLED ||
      booking.status === VisitBookingStatus.COMPLETED
    ) {
      throw new ConflictException({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: `Cannot cancel a booking in status ${booking.status}`,
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.visitBooking.update({
        where: { id: bookingId },
        data: { status: VisitBookingStatus.CANCELLED },
      });
      await tx.visitSlot.update({
        where: { id: booking.slotId },
        data: { status: VisitSlotStatus.AVAILABLE },
      });
      return b;
    });
    return this.bookingToPublic(updated);
  }

  async listMyBookings(userId: string): Promise<PublicVisitBooking[]> {
    const rows = await this.prisma.visitBooking.findMany({
      where: { userId },
      include: { slot: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((b) => ({
      ...this.bookingToPublic(b),
      slotStartAt: b.slot.startAt.toISOString(),
      slotEndAt: b.slot.endAt.toISOString(),
    }));
  }

  async listManagedBookings(userId: string): Promise<PublicVisitBooking[]> {
    const ids = await this.agencyAccess.listOperablePropertyIds(userId);
    if (ids.length === 0) return [];
    const rows = await this.prisma.visitBooking.findMany({
      where: { propertyId: { in: ids } },
      include: { slot: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((b) => ({
      ...this.bookingToPublic(b),
      slotStartAt: b.slot.startAt.toISOString(),
      slotEndAt: b.slot.endAt.toISOString(),
    }));
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
    await this.agencyAccess.assertCanOperateOnProperty(userId, propertyId);
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

  private bookingToPublic(b: VisitBooking): PublicVisitBooking {
    return {
      id: b.id,
      slotId: b.slotId,
      propertyId: b.propertyId,
      userId: b.userId,
      status: b.status,
      paymentId: b.paymentId,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
