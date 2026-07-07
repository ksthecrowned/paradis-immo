import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Booking, BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { AvailabilityService } from './availability.service';

export interface PublicBooking {
  id: string;
  propertyId: string;
  userId: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface CreateBookingInput {
  propertyId: string;
  startDate: Date;
  endDate: Date;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly availability: AvailabilityService,
    private readonly events: EventPublisher,
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

    // Check for overlapping non-cancelled bookings.
    const overlap = await this.prisma.booking.findFirst({
      where: {
        propertyId: input.propertyId,
        status: { in: [BookingStatus.PENDING, BookingStatus.CONFIRMED] },
        AND: [
          { startDate: { lt: input.endDate } },
          { endDate: { gt: input.startDate } },
        ],
      },
      select: { id: true },
    });
    if (overlap) {
      throw new ConflictException({
        code: 'BOOKING_OVERLAP',
        message: 'This property is already booked for the requested range',
      });
    }

    const nights = this.computeNights(input.startDate, input.endDate);
    const totalPrice = new Prisma.Decimal(property.price).mul(nights);
    const currency = property.currency;

    // Booking + AvailabilityBlock in a single transaction for atomicity.
    const booking = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.create({
        data: {
          propertyId: input.propertyId,
          userId,
          startDate: input.startDate,
          endDate: input.endDate,
          totalPrice,
          currency,
          status: BookingStatus.CONFIRMED,
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

    await this.events.emit(DOMAIN_EVENTS.PAYMENT_INITIATED, {
      paymentId: booking.id, // placeholder until Task 16
      userId,
      amount: totalPrice.toString(),
      currency,
    });

    return this.toPublic(booking);
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
    if (booking.status === BookingStatus.CANCELLED) {
      return this.toPublic(booking);
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: { status: BookingStatus.CANCELLED },
      });
      await tx.availabilityBlock.deleteMany({
        where: { propertyId: booking.propertyId, refId: booking.id },
      });
      return b;
    });
    return this.toPublic(updated);
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
      createdAt: b.createdAt.toISOString(),
    };
  }
}
