import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AvailabilityService } from './availability.service';
import { UsersService } from '../users/users.service';
import { PricingService } from './pricing.service';
import type { PricingQuote } from './pricing.service';

export interface PublicBooking {
  id: string;
  propertyId: string;
  userId: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  currency: string;
  status: string;
  /** Spec 07 — hold 15 min (PENDING_PAYMENT) ou fenêtre de paiement. */
  holdExpiresAt: string | null;
  /** Devis figé au hold (spec 07). */
  quote: PricingQuote | null;
  refundAmount?: string | null;
  refundPercent?: number;
  createdAt: string;
}

export interface CreateBookingInput {
  propertyId: string;
  startDate: Date;
  endDate: Date;
  /** Spec 07 — nombre de voyageurs (défaut 2). */
  guests?: number;
  guestPhone?: string;
  guestName?: string;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly events: EventPublisher,
    private readonly users: UsersService,
    private readonly pricing: PricingService,
  ) {}

  async createBooking(
    userId: string,
    input: CreateBookingInput,
  ): Promise<PublicBooking> {
    if (input.endDate <= input.startDate) {
      throw new BadRequestException({
        code: 'INVALID_DATE_RANGE',
        message: 'endDate must be after startDate',
      });
    }

    const property = await this.prisma.property.findUnique({
      where: { id: input.propertyId },
      select: {
        id: true,
        mode: true,
        price: true,
        currency: true,
        priceUnit: true,
        ownerId: true,
        organizationId: true,
        minNights: true,
        maxNights: true,
      },
    });
    if (!property) {
      throw new NotFoundException({
        code: 'PROPERTY_NOT_FOUND',
        message: 'Property does not exist',
      });
    }
    if (property.mode !== 'RENT_SHORT') {
      throw new BadRequestException({
        code: 'BOOKING_MODE_NOT_ALLOWED',
        message: 'Bookings are only available for RENT_SHORT properties',
      });
    }
    if (property.priceUnit !== 'NIGHT') {
      throw new BadRequestException({
        code: 'BOOKING_INVALID_PRICE_UNIT',
        message: 'RENT_SHORT properties must use NIGHT as priceUnit',
      });
    }

    const minNights = property.minNights ?? 1;
    const nights = this.computeNights(input.startDate, input.endDate);
    if (nights < minNights) {
      throw new BadRequestException({
        code: 'STAY_TOO_SHORT',
        message: `Séjour trop court (minimum ${minNights} nuit(s))`,
        minNights,
      });
    }
    if (property.maxNights != null && nights > property.maxNights) {
      throw new BadRequestException({
        code: 'STAY_TOO_LONG',
        message: `Séjour trop long (maximum ${property.maxNights} nuit(s))`,
        maxNights: property.maxNights,
      });
    }

    let guestUserId = userId;
    if (input.guestPhone) {
      if (property.ownerId !== userId) {
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
              'Only the owner or a member of the managing org can book on behalf of a guest',
          });
        }
      }
      const guest = await this.users.resolveOrCreateByPhone(
        input.guestPhone,
        input.guestName,
      );
      guestUserId = guest.id;
    }

    // Spec 07 — pricing quote computed server side and frozen into the booking.
    const guests = input.guests ?? 2;
    if (guests < 1) {
      throw new BadRequestException({
        code: 'INVALID_GUESTS',
        message: 'guests must be at least 1',
      });
    }
    const quote = await this.pricing.quote(input.propertyId, {
      startDate: input.startDate,
      endDate: input.endDate,
      guests,
    });
    if (guests > quote.maxGuests) {
      throw new BadRequestException({
        code: 'TOO_MANY_GUESTS',
        message: `Maximum ${quote.maxGuests} voyageurs`,
        maxGuests: quote.maxGuests,
      });
    }

    // Spec 07 — anti-overlap including un-expired holds and availability
    // blocks (instant hold: BOOKING blocks are written with the booking).
    const blockingStatuses = [
      BookingStatus.PENDING,
      BookingStatus.PENDING_PAYMENT,
      BookingStatus.CONFIRMED,
      BookingStatus.REQUESTED,
      BookingStatus.ACCEPTED,
      BookingStatus.CHECKED_IN,
    ];
    const overlapBooking = await this.prisma.booking.findFirst({
      where: {
        propertyId: input.propertyId,
        status: { in: blockingStatuses },
        AND: [
          { startDate: { lt: input.endDate } },
          { endDate: { gt: input.startDate } },
        ],
      },
      select: { id: true, status: true, holdExpiresAt: true },
    });
    if (
      overlapBooking &&
      (overlapBooking.status !== BookingStatus.PENDING_PAYMENT ||
        !overlapBooking.holdExpiresAt ||
        overlapBooking.holdExpiresAt > new Date())
    ) {
      throw new ConflictException({
        code: 'BOOKING_OVERLAP',
        message: 'This property is already booked for the requested range',
      });
    }
    const overlapBlock = await this.prisma.availabilityBlock.findFirst({
      where: {
        propertyId: input.propertyId,
        startDate: { lt: input.endDate },
        endDate: { gt: input.startDate },
      },
      select: { id: true },
    });
    if (overlapBlock) {
      throw new ConflictException({
        code: 'BOOKING_BLOCKED',
        message: 'These dates are not available',
      });
    }

    const holdExpiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Booking + blocking AvailabilityBlock in a single transaction (the
    // conditional overlap checks above were performed just before, within
    // the advisory window; hold expiry cron keeps PENDING_PAYMENT from
    // leaking beyond 15 min).
    const booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          propertyId: input.propertyId,
          userId: guestUserId,
          startDate: input.startDate,
          endDate: input.endDate,
          totalPrice: new Prisma.Decimal(quote.total),
          currency: quote.currency,
          status: quote.instantBook
            ? BookingStatus.PENDING_PAYMENT
            : BookingStatus.REQUESTED,
          guests,
          priceBreakdown: quote as unknown as Prisma.InputJsonValue,
          depositAmount: new Prisma.Decimal(quote.deposit),
          holdExpiresAt,
          cancellationPolicy: quote.cancellationPolicy,
        },
      });
      await tx.availabilityBlock.create({
        data: {
          propertyId: input.propertyId,
          startDate: input.startDate,
          endDate: input.endDate,
          reason: 'BOOKING',
          refId: b.id,
        },
      });
      return b;
    });

    if (booking.status === BookingStatus.PENDING_PAYMENT) {
      await this.events.emit(DOMAIN_EVENTS.BOOKING_HELD, {
        bookingId: booking.id,
        userId: booking.userId,
        holdExpiresAt: holdExpiresAt.toISOString(),
      });
    } else {
      await this.events.emit(DOMAIN_EVENTS.BOOKING_REQUESTED, {
        bookingId: booking.id,
        userId: booking.userId,
      });
    }

    return { ...this.toPublic(booking), quote, holdExpiresAt: holdExpiresAt.toISOString() };
  }

  /** Spec 07 — endpoint `POST properties/:id/stay-quote`. */
  async quote(
    propertyId: string,
    input: { startDate: Date; endDate: Date; guests: number },
  ): Promise<PricingQuote> {
    return this.pricing.quote(propertyId, input);
  }

  async listMyBookings(userId: string): Promise<PublicBooking[]> {
    const rows = await this.prisma.booking.findMany({
      where: { userId },
      orderBy: { startDate: 'asc' },
    });
    return rows.map((b) => this.toPublic(b));
  }

  async listManaged(userId: string): Promise<PublicBooking[]> {
    const accessible = await this.prisma.property.findMany({
      where: {
        OR: [
          { ownerId: userId },
          {
            organization: {
              members: { some: { userId } },
            },
          },
        ],
      },
      select: { id: true },
      take: 500,
    });
    const propertyIds = accessible.map((p) => p.id);
    if (propertyIds.length === 0) return [];
    const rows = await this.prisma.booking.findMany({
      where: { propertyId: { in: propertyIds } },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
    return rows.map((b) => this.toPublic(b));
  }

  /**
   * Spec 07 — annulation séjour avec politique de remboursement :
   * FLEXIBLE : 100% jusqu'à 24 h avant ; MODERATE : 100% > 5 jours puis 50% ;
   * STRICT : 50% > 7 jours puis 0% (doc 07). L'hôte annule à 100% voyageur
   * (`cancelByHost`). Le remboursement effectif reste un flux spec 05.
   */
  async cancelBooking(
    userId: string,
    bookingId: string,
  ): Promise<PublicBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking does not exist',
      });
    }
    if (booking.userId !== userId) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_OWNER',
        message: 'Only the booker can cancel a booking',
      });
    }
    return this.cancelBookingInternal(booking, BookingStatus.CANCELLED_BY_GUEST);
  }

  /** Spec 07 — `GET bookings/:id/cancellation-preview` (voyageur). */
  async cancellationPreview(
    userId: string,
    bookingId: string,
  ): Promise<{
    refundPercent: number;
    refundAmount: string;
    currency: string;
  }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking does not exist',
      });
    }
    if (booking.userId !== userId) {
      throw new BadRequestException({
        code: 'BOOKING_NOT_OWNER',
        message: 'Only the booker can preview a cancellation',
      });
    }
    const refundPercent = this.computeRefundPercent(
      booking.cancellationPolicy,
      booking.startDate,
      new Date(),
    );
    const refundAmount = booking.totalPrice.mul(refundPercent).div(100);
    return {
      refundPercent,
      refundAmount: refundAmount.toString(),
      currency: booking.currency,
    };
  }

  /** Spec 07 — annulation hôte : remboursement 100 %, tracée. */
  async cancelByHost(
    userId: string,
    bookingId: string,
    reason?: string,
  ): Promise<PublicBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking does not exist',
      });
    }
    await this.assertCanManageProperty(userId, booking.propertyId);
    return this.cancelBookingInternal(
      booking,
      BookingStatus.CANCELLED_BY_HOST,
      100,
      reason,
    );
  }

  /** Spec 07 — hôte accepte une demande (REQUESTED) : hold 2 h pour payer. */
  async acceptBooking(
    userId: string,
    bookingId: string,
  ): Promise<PublicBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking does not exist',
      });
    }
    await this.assertCanManageProperty(userId, booking.propertyId);
    if (booking.status !== BookingStatus.REQUESTED) {
      throw new ConflictException({
        code: 'BOOKING_NOT_REQUESTED',
        message: `Cannot accept a booking in status ${booking.status}`,
      });
    }
    if (booking.requestExpiresAt && booking.requestExpiresAt < new Date()) {
      throw new ConflictException({
        code: 'REQUEST_EXPIRED',
        message: 'La demande a expiré (24 h)',
      });
    }
    const holdExpiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.ACCEPTED, holdExpiresAt },
    });
    await this.events.emit(DOMAIN_EVENTS.BOOKING_ACCEPTED, {
      bookingId: updated.id,
      userId: updated.userId,
      holdExpiresAt: holdExpiresAt.toISOString(),
    });
    return this.toPublic(updated);
  }

  /** Spec 07 — hôte refuse une demande (REQUESTED) : `{ reason }`. */
  async declineBooking(
    userId: string,
    bookingId: string,
    reason?: string,
  ): Promise<PublicBooking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking does not exist',
      });
    }
    await this.assertCanManageProperty(userId, booking.propertyId);
    if (booking.status !== BookingStatus.REQUESTED) {
      throw new ConflictException({
        code: 'BOOKING_NOT_REQUESTED',
        message: `Cannot decline a booking in status ${booking.status}`,
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.DECLINED,
          cancelReason: reason ?? null,
        },
      });
      await tx.availabilityBlock.deleteMany({
        where: { propertyId: booking.propertyId, refId: booking.id },
      });
      return b;
    });
    await this.events.emit(DOMAIN_EVENTS.BOOKING_DECLINED, {
      bookingId: updated.id,
      userId: updated.userId,
      reason: reason ?? null,
    });
    return this.toPublic(updated);
  }

  /**
   * Spec 07 — check-in hôte (CONFIRMED → CHECKED_IN), puis check-out
   * (CHECKED_IN → COMPLETED ; caution remboursable à J+3 sans réclamation).
   */
  async checkIn(userId: string, bookingId: string): Promise<PublicBooking> {
    const booking = await this.mustManageAndFind(userId, bookingId);
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new ConflictException({
        code: 'BOOKING_NOT_CONFIRMED',
        message: `Cannot check-in a booking in status ${booking.status}`,
      });
    }
    const updated = await this.prisma.booking.update({
      where: { id: bookingId },
      data: { status: BookingStatus.CHECKED_IN, checkedInAt: new Date() },
    });
    await this.events.emit(DOMAIN_EVENTS.BOOKING_CHECKED_IN, {
      bookingId: updated.id,
      userId: updated.userId,
    });
    return this.toPublic(updated);
  }

  async checkOut(userId: string, bookingId: string): Promise<PublicBooking> {
    const booking = await this.mustManageAndFind(userId, bookingId);
    if (booking.status !== BookingStatus.CHECKED_IN) {
      throw new ConflictException({
        code: 'BOOKING_NOT_CHECKED_IN',
        message: `Cannot check-out a booking in status ${booking.status}`,
      });
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: {
          status: BookingStatus.COMPLETED,
          checkedOutAt: new Date(),
        },
      });
      // Séjour terminé : on libère le blocage de disponibilité.
      await tx.availabilityBlock.deleteMany({
        where: { propertyId: booking.propertyId, refId: booking.id },
      });
      return b;
    });
    await this.events.emit(DOMAIN_EVENTS.BOOKING_COMPLETED, {
      bookingId: updated.id,
      userId: updated.userId,
    });
    return this.toPublic(updated);
  }

  /**
   * Spec 07 — `GET bookings/:id/arrival` : instructions d'arrivée révélées
   * au voyageur au plus tôt 48 h avant l'arrivée (et pour un séjour
   * CONFIRMED ou CHECKED_IN) ; adresse exacte masquée avant.
   */
  async getArrival(
    userId: string,
    bookingId: string,
  ): Promise<{
    checkInFrom: string;
    checkOutBefore: string;
    arrivalInstructions: string | null;
    address: string | null;
    maskedBefore: boolean;
  }> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        property: { select: { address: true } },
      },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking does not exist',
      });
    }
    if (booking.userId !== userId) {
      throw new ForbiddenException({
        code: 'BOOKING_NOT_OWNER',
        message: 'Only the booker can view arrival details',
      });
    }
    const settings = await this.prisma.stayListingSettings.findUnique({
      where: { propertyId: booking.propertyId },
      select: {
        checkInFrom: true,
        checkOutBefore: true,
        arrivalInstructions: true,
      },
    });
    const confirmed =
      booking.status === BookingStatus.CONFIRMED ||
      booking.status === BookingStatus.CHECKED_IN;
    const within48h =
      Date.now() >= booking.startDate.getTime() - 48 * 3_600_000;
    const revealed = confirmed && within48h;
    return {
      checkInFrom: settings?.checkInFrom ?? '14:00',
      checkOutBefore: settings?.checkOutBefore ?? '11:00',
      arrivalInstructions: revealed
        ? settings?.arrivalInstructions ?? null
        : null,
      address: revealed ? booking.property.address : null,
      maskedBefore: !revealed,
    };
  }

  /**
   * Spec 07 — `POST bookings/:id/damage-reports` : l'hôte signale un dommage
   * sous 48 h après le check-out ; bloque le remboursement automatique de
   * la caution (litiges spec 05). Tracé via `cancelReason`.
   */
  async reportDamage(
    userId: string,
    bookingId: string,
    input: { description: string; amount: string },
  ): Promise<{ reportId: string; bookingId: string; amount: string }> {
    const booking = await this.mustManageAndFind(userId, bookingId);
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new ConflictException({
        code: 'BOOKING_NOT_COMPLETED',
        message: 'Les dommages se signalent après le départ',
      });
    }
    const checkedOutAt = booking.checkedOutAt?.getTime() ?? 0;
    if (Date.now() - checkedOutAt > 48 * 3_600_000) {
      throw new ConflictException({
        code: 'DAMAGE_WINDOW_EXPIRED',
        message: 'Réclamation possible seulement sous 48 h après le départ',
      });
    }
    const reportId = `dmg_${booking.id}_${Date.now()}`;
    await this.prisma.booking.update({
      where: { id: bookingId },
      data: {
        // Bloque le remboursement auto de la caution (spec 05 litiges).
        cancelReason: `DAMAGE_REPORT:${reportId}:${input.description.slice(0, 200)}`,
      },
    });
    await this.events.emit(DOMAIN_EVENTS.BOOKING_DAMAGE_REPORTED, {
      bookingId: booking.id,
      userId: booking.userId,
      reportId,
      amount: input.amount,
    });
    return { reportId, bookingId: booking.id, amount: input.amount };
  }

  /** Spec 07 — cron : expire les REQUESTED (24 h) et ACCEPTED (hold 2 h). */
  async expireRequestsAndAccepted(): Promise<number> {
    const now = new Date();
    const expiredRequests = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.REQUESTED,
        requestExpiresAt: { lte: now },
      },
      select: { id: true, propertyId: true, userId: true },
    });
    const expiredAccepted = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.ACCEPTED,
        holdExpiresAt: { lte: now },
      },
      select: { id: true, propertyId: true, userId: true },
    });
    const all = [...expiredRequests, ...expiredAccepted];
    if (all.length === 0) return 0;

    await this.prisma.$transaction([
      ...expiredRequests.map((b) =>
        this.prisma.booking.update({
          where: { id: b.id },
          data: { status: BookingStatus.EXPIRED, requestExpiresAt: null },
        }),
      ),
      ...expiredAccepted.map((b) =>
        this.prisma.booking.update({
          where: { id: b.id },
          data: { status: BookingStatus.EXPIRED, holdExpiresAt: null },
        }),
      ),
      this.prisma.availabilityBlock.deleteMany({
        where: { refId: { in: all.map((b) => b.id) }, reason: 'BOOKING' },
      }),
    ]);

    for (const b of expiredRequests) {
      await this.events.emit(DOMAIN_EVENTS.BOOKING_EXPIRED, {
        bookingId: b.id,
        userId: b.userId,
        propertyId: b.propertyId,
      });
    }
    for (const b of expiredAccepted) {
      await this.events.emit(DOMAIN_EVENTS.BOOKING_HOLD_EXPIRED, {
        bookingId: b.id,
        userId: b.userId,
        propertyId: b.propertyId,
      });
    }
    return all.length;
  }

  /** Spec 07 — cron : expire les holds PENDING_PAYMENT échus (15 min). */
  async expireHolds(): Promise<number> {
    const now = new Date();
    const lapsed = await this.prisma.booking.findMany({
      where: {
        status: BookingStatus.PENDING_PAYMENT,
        holdExpiresAt: { lte: now },
      },
      select: { id: true, propertyId: true, userId: true },
    });
    if (lapsed.length === 0) return 0;

    await this.prisma.$transaction([
      ...lapsed.map((b) =>
        this.prisma.booking.update({
          where: { id: b.id },
          data: { status: BookingStatus.EXPIRED, holdExpiresAt: null },
        }),
      ),
      this.prisma.availabilityBlock.deleteMany({
        where: { refId: { in: lapsed.map((b) => b.id) }, reason: 'BOOKING' },
      }),
    ]);

    for (const b of lapsed) {
      await this.events.emit(DOMAIN_EVENTS.BOOKING_HOLD_EXPIRED, {
        bookingId: b.id,
        userId: b.userId,
        propertyId: b.propertyId,
      });
    }
    return lapsed.length;
  }

  /** Noyau commun d'annulation (voyageur ou hôte). */
  private async cancelBookingInternal(
    booking: Booking,
    finalStatus: BookingStatus,
    forcedPercent?: number,
    reason?: string,
  ): Promise<PublicBooking> {
    if (
      ![
        BookingStatus.PENDING_PAYMENT,
        BookingStatus.REQUESTED,
        BookingStatus.ACCEPTED,
        BookingStatus.CONFIRMED,
      ].some((s) => s === booking.status)
    ) {
      throw new ConflictException({
        code: 'BOOKING_NOT_CANCELLABLE',
        message: `Cannot cancel a booking in status ${booking.status}`,
      });
    }
    const refundPercent =
      forcedPercent ??
      this.computeRefundPercent(
        booking.cancellationPolicy,
        booking.startDate,
        new Date(),
      );
    const refundAmount = booking.totalPrice.mul(refundPercent).div(100);

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: booking.id },
        data: {
          status: finalStatus,
          cancelledAt: new Date(),
          cancelledById: booking.userId,
          cancelReason: reason ?? booking.cancelReason,
          refundAmount: refundAmount.greaterThan(0) ? refundAmount : null,
        },
      });
      await tx.availabilityBlock.deleteMany({
        where: { propertyId: booking.propertyId, refId: booking.id },
      });
      return b;
    });

    await this.events.emit(DOMAIN_EVENTS.BOOKING_CANCELLED, {
      bookingId: booking.id,
      userId: booking.userId,
      refundPercent,
      refundAmount: refundAmount.toString(),
      reason: reason ?? null,
    });

    return {
      ...this.toPublic(updated),
      refundPercent,
      refundAmount: refundAmount.toString(),
    };
  }

  private async mustManageAndFind(
    userId: string,
    bookingId: string,
  ): Promise<Booking> {
    const booking = await this.prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundException({
        code: 'BOOKING_NOT_FOUND',
        message: 'Booking does not exist',
      });
    }
    await this.assertCanManageProperty(userId, booking.propertyId);
    return booking;
  }

  private async assertCanManageProperty(
    userId: string,
    propertyId: string,
  ): Promise<void> {
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
    if (property.ownerId === userId) return;
    if (property.organizationId) {
      const member = await this.prisma.organizationMember.findUnique({
        where: {
          userId_organizationId: {
            userId,
            organizationId: property.organizationId,
          },
        },
      });
      if (member) return;
    }
    throw new ForbiddenException({
      code: 'NOT_ASSIGNED_AGENT',
      message:
        'Only the owner, agency gérant, or assigned agent can manage this property',
    });
  }

  /** Spec 07 — politique de remboursement selon délai avant arrivée. */
  private computeRefundPercent(
    policy: string | null,
    startDate: Date,
    now: Date,
  ): number {
    const hoursLeft = (startDate.getTime() - now.getTime()) / 3_600_000;
    switch (policy) {
      case 'MODERATE':
        if (hoursLeft >= 120) return 100;
        if (hoursLeft >= 24) return 50;
        return 0;
      case 'STRICT':
        if (hoursLeft >= 336) return 100;
        if (hoursLeft >= 168) return 50;
        return 0;
      case 'FLEXIBLE':
      default:
        return hoursLeft > 0 ? 100 : 0;
    }
  }

  private computeNights(start: Date, end: Date): number {
    const ms = end.getTime() - start.getTime();
    return Math.max(0, Math.round(ms / (24 * 60 * 60 * 1000)));
  }

  private toPublic(b: Booking): PublicBooking {
    return {
      id: b.id,
      propertyId: b.propertyId,
      userId: b.userId,
      startDate: b.startDate.toISOString(),
      endDate: b.endDate.toISOString(),
      totalPrice: b.totalPrice.toString(),
      currency: b.currency,
      status: b.status,
      /** Spec 07 — hold pose uniquement sur PENDING_PAYMENT. */
      holdExpiresAt: b.status === BookingStatus.PENDING_PAYMENT
        ? b.holdExpiresAt?.toISOString() ?? null
        : null,
      /** Devis fige au hold (priceBreakdown JSON). */
      quote: (b.priceBreakdown as PricingQuote | null) ?? null,
      createdAt: b.createdAt.toISOString(),
    };
  }
}
