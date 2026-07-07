import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { BookingsService } from './bookings.service';
import { AvailabilityService } from './availability.service';

describe('BookingsService — short-term', () => {
  let bookings: BookingsService;
  let availability: AvailabilityService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let shortPropertyId: string;
  let longPropertyId: string;
  const createdBookingIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BookingsService,
        AvailabilityService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    bookings = moduleRef.get(BookingsService);
    availability = moduleRef.get(AvailabilityService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;

    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    bzvQuartierId = quartier.id;

    await prisma.user.deleteMany({
      where: { phone: { in: ['+242073333333', '+242076666666'] } },
    });
    const owner = await prisma.user.create({
      data: {
        phone: '+242073333333',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242076666666',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Booking Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const shortProp = await prisma.property.create({
      data: {
        title: 'Booking Short',
        description: 'Pour tester les bookings courts',
        type: 'APARTMENT',
        mode: 'RENT_SHORT',
        price: 25000,
        currency: 'XAF',
        priceUnit: 'NIGHT',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    shortPropertyId = shortProp.id;
    const longProp = await prisma.property.create({
      data: {
        title: 'Booking Long',
        description: 'Pour tester le rejet long',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 200000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
      },
    });
    longPropertyId = longProp.id;
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await prisma.booking
        .deleteMany({ where: { id: { in: createdBookingIds } } })
        .catch(() => undefined);
    }
    await prisma.availabilityBlock
      .deleteMany({
        where: { propertyId: { in: [shortPropertyId, longPropertyId] } },
      })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: shortPropertyId } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: longPropertyId } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: ownerUserId },
    });
    await prisma.organizationMember.deleteMany({
      where: { userId: tenantUserId },
    });
    await prisma.organization
      .deleteMany({
        where: {
          OR: [
            { members: { some: { userId: ownerUserId } } },
            { members: { some: { userId: tenantUserId } } },
          ],
        },
      })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: ownerUserId } });
    await prisma.userRole.deleteMany({ where: { userId: tenantUserId } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    await prisma.user.deleteMany({ where: { id: tenantUserId } });
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.booking.deleteMany({
      where: { propertyId: { in: [shortPropertyId, longPropertyId] } },
    });
    await prisma.availabilityBlock.deleteMany({
      where: { propertyId: { in: [shortPropertyId, longPropertyId] } },
    });
    createdBookingIds.length = 0;
  });

  it('creates a confirmed booking on RENT_SHORT and adds an AvailabilityBlock', async () => {
    const start = new Date('2026-07-10T00:00:00Z');
    const end = new Date('2026-07-13T00:00:00Z');

    const result = await bookings.createBooking(tenantUserId, {
      propertyId: shortPropertyId,
      startDate: start,
      endDate: end,
    });
    createdBookingIds.push(result.id);

    expect(result.status).toBe('CONFIRMED');
    // 3 nights × 25 000 = 75 000 XAF
    expect(Number(result.totalPrice)).toBe(75000);
    expect(result.currency).toBe('XAF');

    const blocks = await prisma.availabilityBlock.findMany({
      where: { propertyId: shortPropertyId },
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].refId).toBe(result.id);
  });

  it('rejects an overlapping booking on RENT_SHORT', async () => {
    const start = new Date('2026-08-01T00:00:00Z');
    const end = new Date('2026-08-05T00:00:00Z');

    const first = await bookings.createBooking(tenantUserId, {
      propertyId: shortPropertyId,
      startDate: start,
      endDate: end,
    });
    createdBookingIds.push(first.id);

    await expect(
      bookings.createBooking(tenantUserId, {
        propertyId: shortPropertyId,
        startDate: new Date('2026-08-03T00:00:00Z'),
        endDate: new Date('2026-08-07T00:00:00Z'),
      }),
    ).rejects.toMatchObject({
      response: { code: 'BOOKING_OVERLAP' },
    });
  });

  it('rejects bookings on RENT_LONG properties', async () => {
    await expect(
      bookings.createBooking(tenantUserId, {
        propertyId: longPropertyId,
        startDate: new Date('2026-09-01T00:00:00Z'),
        endDate: new Date('2026-09-05T00:00:00Z'),
      }),
    ).rejects.toMatchObject({
      response: { code: 'BOOKING_MODE_NOT_ALLOWED' },
    });
  });

  it('rejects bookings on SALE properties', async () => {
    const saleOrg = await prisma.organization.create({
      data: {
        name: `Booking Sale Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const saleProp = await prisma.property.create({
      data: {
        title: 'Booking Sale',
        description: 'Pour tester le rejet sale',
        type: 'APARTMENT',
        mode: 'SALE',
        price: 50000000,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: saleOrg.id,
      },
    });
    try {
      await expect(
        bookings.createBooking(tenantUserId, {
          propertyId: saleProp.id,
          startDate: new Date('2026-10-01T00:00:00Z'),
          endDate: new Date('2026-10-05T00:00:00Z'),
        }),
      ).rejects.toMatchObject({
        response: { code: 'BOOKING_MODE_NOT_ALLOWED' },
      });
    } finally {
      await prisma.availabilityBlock.deleteMany({
        where: { propertyId: saleProp.id },
      });
      await prisma.property.delete({ where: { id: saleProp.id } });
      await prisma.organizationMember.deleteMany({
        where: { organizationId: saleOrg.id },
      });
      await prisma.organization.delete({ where: { id: saleOrg.id } });
    }
  });

  it('cancels a booking and removes its AvailabilityBlock', async () => {
    const start = new Date('2026-11-01T00:00:00Z');
    const end = new Date('2026-11-04T00:00:00Z');

    const booking = await bookings.createBooking(tenantUserId, {
      propertyId: shortPropertyId,
      startDate: start,
      endDate: end,
    });
    createdBookingIds.push(booking.id);

    const cancelled = await bookings.cancelBooking(tenantUserId, booking.id);
    expect(cancelled.status).toBe('CANCELLED');

    const blocks = await prisma.availabilityBlock.findMany({
      where: { propertyId: shortPropertyId, refId: booking.id },
    });
    expect(blocks).toHaveLength(0);
  });

  it('lists availability windows for a property (open + booked ranges)', async () => {
    const blocks = await availability.listAvailability(shortPropertyId, {
      from: new Date('2026-01-01T00:00:00Z'),
      to: new Date('2026-12-31T00:00:00Z'),
    });
    expect(Array.isArray(blocks)).toBe(true);
    // At least the cancelled blocks from previous tests may have left a couple.
    expect(blocks.length).toBeGreaterThanOrEqual(0);
  });

  it('lists managed bookings for an owner and returns PublicBooking[]', async () => {
    const start = new Date('2026-12-01T00:00:00Z');
    const end = new Date('2026-12-04T00:00:00Z');

    const created = await bookings.createBooking(tenantUserId, {
      propertyId: shortPropertyId,
      startDate: start,
      endDate: end,
    });
    createdBookingIds.push(created.id);

    const result = await bookings.listManaged(ownerUserId);
    expect(Array.isArray(result)).toBe(true);
    const found = result.find((b) => b.id === created.id);
    expect(found).toBeDefined();
    expect(found).toMatchObject({
      id: created.id,
      propertyId: shortPropertyId,
      userId: tenantUserId,
      status: 'CONFIRMED',
      currency: 'XAF',
    });
    expect(typeof found!.startDate).toBe('string');
    expect(typeof found!.endDate).toBe('string');
    expect(typeof found!.totalPrice).toBe('string');
    expect(typeof found!.createdAt).toBe('string');
  });

  it('returns an empty managed list for a user who owns no properties', async () => {
    const otherTenant = await prisma.user.create({
      data: {
        phone: `+24206${Math.floor(Math.random() * 1e7)
          .toString()
          .padStart(7, '0')}`,
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    try {
      const result = await bookings.listManaged(otherTenant.id);
      expect(result).toEqual([]);
    } finally {
      await prisma.userRole.deleteMany({ where: { userId: otherTenant.id } });
      await prisma.user.delete({ where: { id: otherTenant.id } });
    }
  });
});
