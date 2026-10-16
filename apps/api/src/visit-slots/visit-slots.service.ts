import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberStatus,
  MandateStatus,
  OrgMemberRole,
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
import { UsersService } from '../users/users.service';
import { SaveVisitReportDto } from './dto/save-visit-report.dto';

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
  agentId: string | null;
  paymentId: string | null;
  /** Spec 06 — hold 15 min sur une visite payante. */
  holdExpiresAt: string | null;
  priceAmount: string | null;
  currency: string | null;
  /** Spec 06 — remboursement calculé à l'annulation (politique 24h/2h). */
  refundPercent?: number;
  createdAt: string;
  slotStartAt?: string;
  slotEndAt?: string;
}

export interface PublicAssignableVisitAgent {
  userId: string;
  name: string | null;
}

/** Spec 06 — plage d'indisponibilité d'un bien (visite). */
export interface PublicVisitBlackout {
  id: string;
  propertyId: string;
  startsAt: string;
  endsAt: string;
  reason: string | null;
  createdAt: string;
}

@Injectable()
export class VisitSlotsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: EventPublisher,
    private readonly agencyAccess: AgencyAccessService,
    private readonly users: UsersService,
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

  /**
   * Spec 06 P2 — plages d'indisponibilité (blackouts). Créer un blackout :
   * 1) marque les slots TEMPLATE/MANUAL qui chevauchent la plage BLOCKED ;
   * 2) annule CANCELLED_BY_AGENCY les visites futures (PENDING/CONFIRMED)
   *    de la plage et libère leurs créneaux, en notifiant les chercheurs ;
   * 3) enregistre la plage pour lister et lever le blackout ensuite.
   */
  async createBlackout(
    userId: string,
    input: {
      propertyId: string;
      startsAt: Date;
      endsAt: Date;
      reason?: string;
    },
  ): Promise<PublicVisitBlackout> {
    await this.assertCanManageProperty(userId, input.propertyId);
    if (input.endsAt <= input.startsAt) {
      throw new BadRequestException({
        code: 'INVALID_BLACKOUT_RANGE',
        message: 'endsAt must be after startsAt',
      });
    }
    if (input.endsAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'BLACKOUT_IN_PAST',
        message: 'A blackout must cover an upcoming period',
      });
    }

    const created = await this.prisma.visitBlackout.create({
      data: {
        propertyId: input.propertyId,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        reason: input.reason,
        createdById: userId,
      },
    });

    // Slots autres que BOOKED/HELD → BLOCKED. Un slot occupé (booking
    // actif) est traité juste après, avec son booking.
    const overlap = await this.prisma.visitSlot.findMany({
      where: {
        propertyId: input.propertyId,
        startAt: { lt: input.endsAt },
        endAt: { gt: input.startsAt },
      },
      select: { id: true, status: true },
    });
    const bookable = overlap.filter(
      (s) => s.status === VisitSlotStatus.AVAILABLE,
    );
    if (bookable.length > 0) {
      await this.prisma.visitSlot.updateMany({
        where: {
          id: { in: bookable.map((s) => s.id) },
          status: VisitSlotStatus.AVAILABLE,
        },
        data: { status: VisitSlotStatus.BLOCKED },
      });
    }

    // Visites futures actives dans la plage : annulation + libération.
    const affected = await this.prisma.visitBooking.findMany({
      where: {
        propertyId: input.propertyId,
        status: {
          in: [VisitBookingStatus.PENDING, VisitBookingStatus.CONFIRMED],
        },
        slot: {
          startAt: { lt: input.endsAt },
          endAt: { gt: input.startsAt },
        },
      },
      select: { id: true, slotId: true, userId: true },
    });
    for (const booking of affected) {
      await this.prisma.$transaction(async (tx) => {
        await tx.visitBooking.update({
          where: { id: booking.id },
          data: {
            // L'enum actuel ne distingue pas CANCELLED_BY_* (spec 06) :
            // cancelledById ≠ visitor ⇒ annulation par l'agence/gestionnaire.
            status: VisitBookingStatus.CANCELLED,
            cancelledById: userId,
            cancelledAt: new Date(),
            cancelReason: input.reason ?? 'Indisponibilité du bien',
          },
        });
        await tx.visitSlot.update({
          where: { id: booking.slotId },
          data: {
            status: VisitSlotStatus.BLOCKED,
          },
        });
      });
      await this.events.emit(DOMAIN_EVENTS.VISIT_BOOKING_CANCELLED, {
        bookingId: booking.id,
        slotId: booking.slotId,
        userId: booking.userId,
        cancelledById: userId,
      });
    }

    return this.blackoutToPublic(created);
  }

  async listBlackouts(
    userId: string,
    propertyId: string,
  ): Promise<PublicVisitBlackout[]> {
    await this.assertCanManageProperty(userId, propertyId);
    const rows = await this.prisma.visitBlackout.findMany({
      where: { propertyId },
      orderBy: { startsAt: 'asc' },
    });
    return rows.map((b) => this.blackoutToPublic(b));
  }

  /** Lever un blackout : les slots BLOCKED de la plage redeviennent AVAILABLE. */
  async deleteBlackout(userId: string, blackoutId: string): Promise<void> {
    const blackout = await this.prisma.visitBlackout.findUnique({
      where: { id: blackoutId },
    });
    if (!blackout) {
      throw new NotFoundException({
        code: 'BLACKOUT_NOT_FOUND',
        message: 'Visit blackout does not exist',
      });
    }
    await this.assertCanManageProperty(userId, blackout.propertyId);

    // Note : si plusieurs blackouts se chevauchent, lever celui-ci peut
    // rendre AVAILABLE un créneau encore couvert par un autre. Les appelants
    // gèrent ça à l'usage ; on garde le comportement simple.
    const slots = await this.prisma.visitSlot.findMany({
      where: {
        propertyId: blackout.propertyId,
        startAt: { lt: blackout.endsAt },
        endAt: { gt: blackout.startsAt },
        status: VisitSlotStatus.BLOCKED,
      },
      select: { id: true },
    });
    if (slots.length > 0) {
      await this.prisma.visitSlot.updateMany({
        where: { id: { in: slots.map((s) => s.id) } },
        data: { status: VisitSlotStatus.AVAILABLE },
      });
    }
    await this.prisma.visitBlackout.delete({ where: { id: blackoutId } });
  }

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

  async unblockSlot(userId: string, slotId: string): Promise<PublicVisitSlot> {
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
   * Book a visit slot atomically with its slot-state transition. Free visits
   * are confirmed immediately; paid visits hold the slot for 15 minutes.
   */
  async bookVisit(
    userId: string,
    input: {
      slotId: string;
      propertyId: string;
      guestPhone?: string;
      guestName?: string;
    },
  ): Promise<PublicVisitBooking> {
    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: {
        id: true,
        visitType: true,
        visitEnabled: true,
        visitPrice: true,
      },
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

    let guestUserId = userId;
    if (input.guestPhone) {
      await this.assertCanManageProperty(userId, input.propertyId);
      const guest = await this.users.resolveOrCreateByPhone(
        input.guestPhone,
        input.guestName,
      );
      guestUserId = guest.id;
    }

    const isFree = property.visitType === 'FREE';
    const now = new Date();

    // The conditional slot update is the concurrency lock. Keep it and the
    // unique booking insert in one transaction so a failed insert releases
    // the slot automatically instead of leaving an orphaned hold.
    const booking = await this.prisma.$transaction(async (tx) => {
      const slotResult = await tx.visitSlot.updateMany({
        where: {
          id: input.slotId,
          propertyId: input.propertyId,
          status: VisitSlotStatus.AVAILABLE,
        },
        data: {
          status: isFree ? VisitSlotStatus.BOOKED : VisitSlotStatus.HELD,
        },
      });
      if (slotResult.count === 0) {
        throw new ConflictException({
          code: 'SLOT_NOT_AVAILABLE',
          message: 'This slot is no longer available',
        });
      }

      const holdExpiresAt = isFree
        ? null
        : new Date(now.getTime() + 15 * 60 * 1000);
      return tx.visitBooking.create({
        data: {
          slotId: input.slotId,
          propertyId: input.propertyId,
          userId: guestUserId,
          status: isFree
            ? VisitBookingStatus.CONFIRMED
            : VisitBookingStatus.PENDING,
          holdExpiresAt,
          priceAmount: isFree ? null : (property.visitPrice ?? null),
          currency: isFree ? null : 'XAF',
        },
      });
    });

    if (isFree) {
      await this.events.emit(DOMAIN_EVENTS.VISIT_BOOKING_CONFIRMED, {
        bookingId: booking.id,
        slotId: booking.slotId,
        userId: booking.userId,
      });
    } else {
      await this.events.emit(DOMAIN_EVENTS.VISIT_BOOKING_HELD, {
        bookingId: booking.id,
        slotId: booking.slotId,
        userId: booking.userId,
        holdExpiresAt: booking.holdExpiresAt?.toISOString() ?? null,
      });
    }
    return this.bookingToPublic(booking);
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

  async completeVisit(
    userId: string,
    bookingId: string,
  ): Promise<PublicVisitBooking> {
    return this.closeVisit(userId, bookingId, VisitBookingStatus.COMPLETED);
  }

  async markVisitNoShow(
    userId: string,
    bookingId: string,
  ): Promise<PublicVisitBooking> {
    return this.closeVisit(userId, bookingId, VisitBookingStatus.NO_SHOW);
  }

  private async closeVisit(
    userId: string,
    bookingId: string,
    status: Extract<VisitBookingStatus, 'COMPLETED' | 'NO_SHOW'>,
  ): Promise<PublicVisitBooking> {
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      include: { slot: { select: { startAt: true } } },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Visit booking does not exist',
      });
    }
    await this.assertCanManageVisit(
      userId,
      booking.propertyId,
      booking.agentId,
      booking.agentOrganizationId,
    );
    if (booking.status !== VisitBookingStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'BOOKING_NOT_CONFIRMED',
        message: `Cannot close a booking in status ${booking.status}`,
      });
    }
    if (booking.slot.startAt > new Date()) {
      throw new ConflictException({
        code: 'VISIT_NOT_STARTED',
        message: 'A visit cannot be closed before its scheduled start',
      });
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const changed = await tx.visitBooking.updateMany({
        where: { id: bookingId, status: VisitBookingStatus.CONFIRMED },
        data: {
          status,
          ...(status === VisitBookingStatus.COMPLETED
            ? { completedAt: new Date() }
            : {}),
        },
      });
      if (changed.count === 0) {
        throw new ConflictException({
          code: 'BOOKING_NOT_CONFIRMED',
          message: 'The visit booking was already closed',
        });
      }
      return tx.visitBooking.findUniqueOrThrow({ where: { id: bookingId } });
    });

    await this.events.emit(
      status === VisitBookingStatus.COMPLETED
        ? DOMAIN_EVENTS.VISIT_BOOKING_COMPLETED
        : DOMAIN_EVENTS.VISIT_BOOKING_NO_SHOW,
      {
        bookingId: updated.id,
        slotId: updated.slotId,
        userId: updated.userId,
        propertyId: updated.propertyId,
      },
    );
    return this.bookingToPublic(updated);
  }

  async markUnconfirmedVisits(now = new Date()): Promise<number> {
    const cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const candidates = await this.prisma.visitBooking.findMany({
      where: {
        status: VisitBookingStatus.CONFIRMED,
        slot: { startAt: { lte: cutoff } },
      },
      select: { id: true },
    });
    let marked = 0;
    for (const { id } of candidates) {
      const result = await this.prisma.visitBooking.updateMany({
        where: { id, status: VisitBookingStatus.CONFIRMED },
        data: { status: VisitBookingStatus.COMPLETED_UNCONFIRMED },
      });
      if (result.count === 0) continue;

      const booking = await this.prisma.visitBooking.findUniqueOrThrow({
        where: { id },
        select: { id: true, slotId: true, userId: true, propertyId: true },
      });
      await this.events.emit(DOMAIN_EVENTS.VISIT_BOOKING_UNCONFIRMED, {
        bookingId: booking.id,
        slotId: booking.slotId,
        userId: booking.userId,
        propertyId: booking.propertyId,
      });
      marked++;
    }
    return marked;
  }

  async sendVisitReminders(now = new Date()): Promise<number> {
    const bookings = await this.prisma.visitBooking.findMany({
      where: {
        status: VisitBookingStatus.CONFIRMED,
        slot: { startAt: { gt: now } },
        OR: [
          {
            slot: {
              startAt: { lte: new Date(now.getTime() + 24 * 60 * 60 * 1000) },
            },
            reminderJ1SentAt: null,
          },
          {
            slot: {
              startAt: { lte: new Date(now.getTime() + 2 * 60 * 60 * 1000) },
            },
            reminderH2SentAt: null,
          },
        ],
      },
      select: {
        id: true,
        slotId: true,
        userId: true,
        agentId: true,
        slot: { select: { startAt: true } },
      },
    });
    let sent = 0;
    for (const booking of bookings) {
      const hoursUntilVisit =
        (booking.slot.startAt.getTime() - now.getTime()) / 3_600_000;
      const kind = hoursUntilVisit <= 2 ? 'H2' : 'J1';
      const result = await this.prisma.visitBooking.updateMany({
        where: {
          id: booking.id,
          status: VisitBookingStatus.CONFIRMED,
          ...(kind === 'J1'
            ? { reminderJ1SentAt: null }
            : { reminderH2SentAt: null }),
        },
        data:
          kind === 'J1' ? { reminderJ1SentAt: now } : { reminderH2SentAt: now },
      });
      if (result.count === 0) continue;
      await this.events.emit(DOMAIN_EVENTS.VISIT_REMINDER, {
        bookingId: booking.id,
        slotId: booking.slotId,
        userId: booking.userId,
        agentId: booking.agentId,
        kind,
      });
      sent++;
    }
    return sent;
  }

  async saveVisitReport(
    userId: string,
    bookingId: string,
    input: SaveVisitReportDto,
  ) {
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        propertyId: true,
        agentId: true,
        agentOrganizationId: true,
        status: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Visit booking does not exist',
      });
    }
    await this.assertCanManageVisit(
      userId,
      booking.propertyId,
      booking.agentId,
      booking.agentOrganizationId,
    );
    if (booking.status !== VisitBookingStatus.COMPLETED) {
      throw new ConflictException({
        code: 'VISIT_NOT_COMPLETED',
        message:
          'A visit report can only be saved after the visit is completed',
      });
    }
    if (input.nextStep === 'FOLLOW_UP' && !input.followUpAt) {
      throw new BadRequestException({
        code: 'FOLLOW_UP_DATE_REQUIRED',
        message: 'followUpAt is required when nextStep is FOLLOW_UP',
      });
    }
    return this.prisma.visitReport.upsert({
      where: { visitBookingId: bookingId },
      create: {
        visitBookingId: bookingId,
        authorId: userId,
        interestLevel: input.interestLevel,
        notes: input.notes,
        nextStep: input.nextStep,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
      },
      update: {
        authorId: userId,
        interestLevel: input.interestLevel,
        notes: input.notes,
        nextStep: input.nextStep,
        followUpAt: input.followUpAt ? new Date(input.followUpAt) : null,
      },
      select: {
        id: true,
        visitBookingId: true,
        authorId: true,
        interestLevel: true,
        notes: true,
        nextStep: true,
        followUpAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async assignVisitAgent(
    userId: string,
    bookingId: string,
    agentId: string | null,
  ): Promise<PublicVisitBooking> {
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      select: {
        id: true,
        propertyId: true,
        agentId: true,
        status: true,
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Visit booking does not exist',
      });
    }
    if (
      booking.status !== VisitBookingStatus.PENDING &&
      booking.status !== VisitBookingStatus.CONFIRMED
    ) {
      throw new ConflictException({
        code: 'BOOKING_NOT_ASSIGNABLE',
        message: `Cannot assign an agent to a booking in status ${booking.status}`,
      });
    }

    const organizationId = await this.getVisitAssignmentOrganization(
      userId,
      booking.propertyId,
    );
    if (agentId !== null) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: { userId: agentId, organizationId },
        },
        select: { role: true, status: true },
      });
      if (
        !member ||
        member.role !== OrgMemberRole.AGENT ||
        member.status !== MemberStatus.ACTIVE
      ) {
        throw new BadRequestException({
          code: 'INVALID_VISIT_AGENT',
          message:
            'The assigned user must be an active agent in the property agency',
        });
      }
    }

    const changed = await this.prisma.visitBooking.updateMany({
      where: {
        id: bookingId,
        status: {
          in: [VisitBookingStatus.PENDING, VisitBookingStatus.CONFIRMED],
        },
      },
      data: {
        agentId,
        agentOrganizationId: agentId ? organizationId : null,
      },
    });
    if (changed.count === 0) {
      throw new ConflictException({
        code: 'BOOKING_NOT_ASSIGNABLE',
        message: 'The visit booking was closed before the assignment completed',
      });
    }
    const updated = await this.prisma.visitBooking.findUniqueOrThrow({
      where: { id: bookingId },
    });
    if (agentId && agentId !== booking.agentId) {
      await this.events.emit(DOMAIN_EVENTS.VISIT_AGENT_ASSIGNED, {
        bookingId,
        agentId,
        assignedBy: userId,
      });
    }
    return this.bookingToPublic(updated);
  }

  async listAssignableVisitAgents(
    userId: string,
    propertyId: string,
  ): Promise<PublicAssignableVisitAgent[]> {
    const organizationId = await this.getVisitAssignmentOrganization(
      userId,
      propertyId,
    );
    const members = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        role: OrgMemberRole.AGENT,
        status: MemberStatus.ACTIVE,
      },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((member) => ({
      userId: member.user.id,
      name: member.user.name,
    }));
  }

  /**
   * Cancel a booking. Either the tenant who created it or a property
   * manager (owner / org member) can cancel. Slot is freed.
   *
   * Spec 06 — politique de remboursement (visite payante) : par le chercheur,
   * 100 % au-delà de 24 h avant le début, 50 % entre 24 h et 2 h, 0 % sous
   * 2 h ; par l'agence, toujours 100 %. La fraction est renvoyée dans
   * `refundPercent` ; le déclenchement effectif du refund (05) reste à
   * scanner côté paiement.
   */
  async cancelVisit(
    userId: string,
    bookingId: string,
  ): Promise<PublicVisitBooking> {
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      include: { slot: { select: { startAt: true } } },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Visit booking does not exist',
      });
    }
    const isManager = booking.userId !== userId;
    if (isManager) {
      await this.assertCanManageProperty(userId, booking.propertyId);
    }
    if (
      booking.status === VisitBookingStatus.CANCELLED ||
      booking.status === VisitBookingStatus.EXPIRED
    ) {
      throw new ConflictException({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: `Cannot cancel a booking in status ${booking.status}`,
      });
    }

    const hoursBefore =
      (booking.slot.startAt.getTime() - Date.now()) / 3_600_000;
    let refundPercent = 0;
    if (!isManager && booking.priceAmount && booking.paymentId) {
      refundPercent = hoursBefore >= 24 ? 100 : hoursBefore >= 2 ? 50 : 0;
    } else if (isManager) {
      refundPercent = 100;
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.visitBooking.update({
        where: { id: bookingId },
        data: {
          status: VisitBookingStatus.CANCELLED,
          cancelledById: userId,
          cancelledAt: new Date(),
        },
      });
      await tx.visitSlot.update({
        where: { id: booking.slotId },
        data: { status: VisitSlotStatus.AVAILABLE },
      });
      return b;
    });
    return { ...this.bookingToPublic(updated), refundPercent };
  }

  /**
   * Spec 06 — Reprogrammation (delta 06.3/06.5) : chercheur ou gestionnaire
   * déplace une réservation ouverte vers un autre créneau AVAILABLE du même
   * bien. Règles :
   * - le créneau cible doit être AVAILABLE (atomicité via updateMany
   *   conditionnel : un slot BOOKED/HELD/BLOCKED/blackout answer 409);
   * - un blackout est matérialisé par un slot BLOCKED, donc refusé aussi ;
   * - l'ancien créneau redevient AVAILABLE (libéré immédiatement) ;
   * - hold payant : il repart pour 15 min sur le nouveau créneau ;
   * - `rescheduleCount` est incrémenté (traçabilité).
   */
  async rescheduleVisit(
    userId: string,
    bookingId: string,
    newSlotId: string,
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
    const isManager = booking.userId !== userId;
    if (isManager) {
      await this.assertCanManageProperty(userId, booking.propertyId);
    }
    if (
      booking.status !== VisitBookingStatus.PENDING &&
      booking.status !== VisitBookingStatus.CONFIRMED
    ) {
      throw new ConflictException({
        code: 'BOOKING_NOT_RESCHEDULABLE',
        message: `Cannot reschedule a booking in status ${booking.status}`,
      });
    }
    if (booking.slotId === newSlotId) {
      throw new BadRequestException({
        code: 'SAME_SLOT',
        message: 'The new slot must differ from the current one',
      });
    }
    const target = await this.prisma.visitSlot.findUnique({
      where: { id: newSlotId },
      select: { propertyId: true },
    });
    if (!target || target.propertyId !== booking.propertyId) {
      throw new NotFoundException({
        code: 'SLOT_NOT_FOUND',
        message: 'Target slot does not exist on this property',
      });
    }

    const wasPaidPending =
      booking.status === VisitBookingStatus.PENDING &&
      booking.holdExpiresAt !== null;
    const updated = await this.prisma.$transaction(async (tx) => {
      // Verrou de concurrence : updateMany conditionnel sur le slot cible.
      const moved = await tx.visitSlot.updateMany({
        where: {
          id: newSlotId,
          propertyId: booking.propertyId,
          status: VisitSlotStatus.AVAILABLE,
        },
        data: {
          status: wasPaidPending
            ? VisitSlotStatus.HELD
            : VisitSlotStatus.BOOKED,
        },
      });
      if (moved.count === 0) {
        throw new ConflictException({
          code: 'SLOT_NOT_AVAILABLE',
          message: 'The target slot is no longer available',
        });
      }
      // Libère l'ancien créneau (s'il est encore porté par ce booking).
      await tx.visitSlot.updateMany({
        where: {
          id: booking.slotId,
          status: { in: [VisitSlotStatus.BOOKED, VisitSlotStatus.HELD] },
        },
        data: { status: VisitSlotStatus.AVAILABLE },
      });
      return tx.visitBooking.update({
        where: { id: bookingId },
        data: {
          slotId: newSlotId,
          holdExpiresAt: wasPaidPending
            ? new Date(Date.now() + 15 * 60 * 1000)
            : null,
          rescheduleCount: { increment: 1 },
        },
      });
    });

    if (updated.status === VisitBookingStatus.CONFIRMED) {
      await this.events.emit(DOMAIN_EVENTS.VISIT_BOOKING_CONFIRMED, {
        bookingId: updated.id,
        slotId: updated.slotId,
        userId: updated.userId,
      });
    } else {
      await this.events.emit(DOMAIN_EVENTS.VISIT_BOOKING_HELD, {
        bookingId: updated.id,
        slotId: updated.slotId,
        userId: updated.userId,
        holdExpiresAt: updated.holdExpiresAt?.toISOString() ?? null,
      });
    }
    return this.bookingToPublic(updated);
  }

  /**
   * Spec 06 — expiration des holds : a `PENDING` paid booking whose
   * `holdExpiresAt` has lapsed becomes `EXPIRED` and its slot returns to
   * `AVAILABLE`. Public for direct invocation from tests / the minutely cron.
   */
  async expireHolds(now = new Date()): Promise<number> {
    const stale = await this.prisma.visitBooking.findMany({
      where: {
        status: VisitBookingStatus.PENDING,
        holdExpiresAt: { lte: now },
      },
      select: { id: true, slotId: true },
    });
    for (const b of stale) {
      await this.prisma.$transaction(async (tx) => {
        await tx.visitBooking.update({
          where: { id: b.id },
          data: { status: VisitBookingStatus.EXPIRED },
        });
        await tx.visitSlot.updateMany({
          where: {
            id: b.slotId,
            status: VisitSlotStatus.HELD,
            booking: { id: b.id },
          },
          data: { status: VisitSlotStatus.AVAILABLE },
        });
      });
    }
    return stale.length;
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
    const [ids, memberships] = await Promise.all([
      this.agencyAccess.listOperablePropertyIds(userId),
      this.prisma.organizationMember.findMany({
        where: {
          userId,
          role: OrgMemberRole.AGENT,
          status: MemberStatus.ACTIVE,
        },
        select: { organizationId: true },
      }),
    ]);
    const organizationIds = memberships.map((member) => member.organizationId);
    if (ids.length === 0 && organizationIds.length === 0) return [];
    const activeMandates =
      organizationIds.length > 0
        ? await this.prisma.mandate.findMany({
            where: {
              organizationId: { in: organizationIds },
              OR: [
                { status: MandateStatus.ACTIVE },
                {
                  status: MandateStatus.TERMINATING,
                  terminationEffectiveAt: { gt: new Date() },
                },
              ],
            },
            select: { propertyId: true, organizationId: true },
          })
        : [];
    const activeMandateKeys = new Set(
      activeMandates.map((mandate) =>
        this.visitAgentScopeKey(mandate.propertyId, mandate.organizationId),
      ),
    );
    const rows = await this.prisma.visitBooking.findMany({
      where: {
        OR: [
          ...(ids.length > 0 ? [{ propertyId: { in: ids } }] : []),
          ...(organizationIds.length > 0
            ? [
                {
                  agentId: userId,
                  agentOrganizationId: { in: organizationIds },
                },
              ]
            : []),
        ],
      },
      include: {
        slot: true,
        property: { select: { organizationId: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows
      .filter(
        (booking) =>
          ids.includes(booking.propertyId) ||
          (booking.agentOrganizationId === booking.property.organizationId &&
            organizationIds.includes(booking.agentOrganizationId)) ||
          (booking.agentOrganizationId !== null &&
            activeMandateKeys.has(
              this.visitAgentScopeKey(
                booking.propertyId,
                booking.agentOrganizationId,
              ),
            )),
      )
      .map((b) => ({
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

  private async assertCanManageVisit(
    userId: string,
    propertyId: string,
    assignedAgentId: string | null,
    assignedOrganizationId: string | null,
  ): Promise<void> {
    if (assignedAgentId === userId) {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { organizationId: true },
      });
      if (!property) {
        throw new NotFoundException({
          code: 'PROPERTY_NOT_FOUND',
          message: 'Property does not exist',
        });
      }
      if (!assignedOrganizationId) {
        throw new ForbiddenException({
          code: 'NOT_ASSIGNED_AGENT',
          message: 'Only the active agent assigned to this visit can manage it',
        });
      }
      const membership = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: assignedOrganizationId,
          },
        },
        select: { role: true, status: true },
      });
      if (
        membership?.role === OrgMemberRole.AGENT &&
        membership.status === MemberStatus.ACTIVE
      ) {
        if (assignedOrganizationId !== property.organizationId) {
          const activeMandate = await this.prisma.mandate.findFirst({
            where: {
              propertyId,
              organizationId: assignedOrganizationId,
              OR: [
                { status: MandateStatus.ACTIVE },
                {
                  status: MandateStatus.TERMINATING,
                  terminationEffectiveAt: { gt: new Date() },
                },
              ],
            },
            select: { id: true },
          });
          if (!activeMandate) {
            throw new ForbiddenException({
              code: 'NOT_ASSIGNED_AGENT',
              message: 'The agency mandate for this visit is no longer active',
            });
          }
        }
        return;
      }
      throw new ForbiddenException({
        code: 'NOT_ASSIGNED_AGENT',
        message: 'Only the active agent assigned to this visit can manage it',
      });
    }
    await this.assertCanManageProperty(userId, propertyId);
  }

  private async getVisitAssignmentOrganization(
    userId: string,
    propertyId: string,
  ): Promise<string> {
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true, organizationId: true },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    const mandate = await this.prisma.mandate.findFirst({
      where: {
        propertyId,
        OR: [
          { status: MandateStatus.ACTIVE },
          {
            status: MandateStatus.TERMINATING,
            terminationEffectiveAt: { gt: new Date() },
          },
        ],
      },
      select: { organizationId: true },
    });
    if (property.ownerId === userId) {
      return mandate?.organizationId ?? property.organizationId;
    }
    if (!mandate) {
      throw new ForbiddenException({
        code: 'NOT_VISIT_MANAGER',
        message:
          'Only the property owner or agency manager can assign a visit agent',
      });
    }
    const member = await this.prisma.organizationMember.findUnique({
      where: {
        userId_organizationId: {
          userId,
          organizationId: mandate.organizationId,
        },
      },
      select: { role: true, status: true },
    });
    if (
      !member ||
      member.role !== OrgMemberRole.ADMIN ||
      member.status !== MemberStatus.ACTIVE
    ) {
      throw new ForbiddenException({
        code: 'NOT_VISIT_MANAGER',
        message:
          'Only the property owner or agency manager can assign a visit agent',
      });
    }
    return mandate.organizationId;
  }

  private visitAgentScopeKey(propertyId: string, organizationId: string) {
    return `${propertyId}:${organizationId}`;
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

  private blackoutToPublic(
    b: Prisma.VisitBlackoutGetPayload<Record<string, never>>,
  ): PublicVisitBlackout {
    return {
      id: b.id,
      propertyId: b.propertyId,
      startsAt: b.startsAt.toISOString(),
      endsAt: b.endsAt.toISOString(),
      reason: b.reason ?? null,
      createdAt: b.createdAt.toISOString(),
    };
  }

  private bookingToPublic(b: VisitBooking): PublicVisitBooking {
    return {
      id: b.id,
      slotId: b.slotId,
      propertyId: b.propertyId,
      userId: b.userId,
      status: b.status,
      agentId: b.agentId,
      paymentId: b.paymentId,
      holdExpiresAt: b.holdExpiresAt?.toISOString() ?? null,
      priceAmount: b.priceAmount?.toString() ?? null,
      currency: b.currency ?? null,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
