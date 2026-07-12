import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { VisitSlotsService } from './visit-slots.service';

describe('VisitSlotsService — booking flow', () => {
  let slots: VisitSlotsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let freePropertyId: string;
  let paidPropertyId: string;
  const createdBookingIds: string[] = [];
  const createdSlotIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VisitSlotsService,
        AgencyAccessService,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    slots = moduleRef.get(VisitSlotsService);
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

    await prisma.user.deleteMany({ where: { phone: '+242071000001' } });
    await prisma.user.deleteMany({ where: { phone: '+242071000002' } });
    const owner = await prisma.user.create({
      data: {
        phone: '+242071000001',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242071000002',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Visit Booking Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const freeProp = await prisma.property.create({
      data: {
        title: 'Visit Booking Free',
        description: 'Pour tester les bookings',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
        visitEnabled: true,
        visitType: 'FREE',
        visitDuration: 30,
      },
    });
    freePropertyId = freeProp.id;
    const paidProp = await prisma.property.create({
      data: {
        title: 'Visit Booking Paid',
        description: 'Pour tester les bookings payants',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
        visitEnabled: true,
        visitType: 'PAID',
        visitPrice: 5000,
        visitDuration: 30,
      },
    });
    paidPropertyId = paidProp.id;
  });

  afterAll(async () => {
    if (createdBookingIds.length) {
      await prisma.visitBooking
        .deleteMany({ where: { id: { in: createdBookingIds } } })
        .catch(() => undefined);
    }
    if (createdSlotIds.length) {
      await prisma.visitSlot
        .deleteMany({ where: { id: { in: createdSlotIds } } })
        .catch(() => undefined);
    }
    await prisma.property
      .deleteMany({ where: { id: freePropertyId } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: paidPropertyId } })
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
    await prisma.visitBooking.deleteMany({
      where: { propertyId: { in: [freePropertyId, paidPropertyId] } },
    });
    await prisma.visitSlot.deleteMany({
      where: { propertyId: { in: [freePropertyId, paidPropertyId] } },
    });
    createdBookingIds.length = 0;
    createdSlotIds.length = 0;
  });

  function createAvailableSlot(offsetHours = 48): {
    startAt: Date;
    endAt: Date;
  } {
    const startAt = new Date(Date.now() + offsetHours * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    return { startAt, endAt };
  }

  it('books a free visit: slot becomes BOOKED and booking is CONFIRMED', async () => {
    const { startAt, endAt } = createAvailableSlot(48);
    const seeded = await prisma.visitSlot.create({
      data: {
        propertyId: freePropertyId,
        startAt,
        endAt,
        status: 'AVAILABLE',
        source: 'TEMPLATE',
      },
    });
    createdSlotIds.push(seeded.id);

    const result = await slots.bookVisit(tenantUserId, {
      slotId: seeded.id,
      propertyId: freePropertyId,
    });
    createdBookingIds.push(result.id);

    expect(result.status).toBe('CONFIRMED');
    expect(result.paymentId).toBeNull();

    const slot = await prisma.visitSlot.findUnique({
      where: { id: seeded.id },
    });
    expect(slot?.status).toBe('BOOKED');
  });

  it('rejects booking when the slot is already BOOKED', async () => {
    const { startAt, endAt } = createAvailableSlot(72);
    const seeded = await prisma.visitSlot.create({
      data: {
        propertyId: freePropertyId,
        startAt,
        endAt,
        status: 'AVAILABLE',
        source: 'TEMPLATE',
      },
    });
    createdSlotIds.push(seeded.id);

    await slots.bookVisit(tenantUserId, {
      slotId: seeded.id,
      propertyId: freePropertyId,
    });
    await expect(
      slots.bookVisit(tenantUserId, {
        slotId: seeded.id,
        propertyId: freePropertyId,
      }),
    ).rejects.toMatchObject({
      response: { code: 'SLOT_NOT_AVAILABLE' },
    });
  });

  it('books a paid visit: booking is PENDING and slot stays AVAILABLE until confirmation', async () => {
    const { startAt, endAt } = createAvailableSlot(96);
    const seeded = await prisma.visitSlot.create({
      data: {
        propertyId: paidPropertyId,
        startAt,
        endAt,
        status: 'AVAILABLE',
        source: 'TEMPLATE',
      },
    });
    createdSlotIds.push(seeded.id);

    const result = await slots.bookVisit(tenantUserId, {
      slotId: seeded.id,
      propertyId: paidPropertyId,
    });
    createdBookingIds.push(result.id);

    expect(result.status).toBe('PENDING');
    expect(result.paymentId).toBeNull();

    const slot = await prisma.visitSlot.findUnique({
      where: { id: seeded.id },
    });
    expect(slot?.status).toBe('AVAILABLE');
  });

  it('confirms a paid booking: slot becomes BOOKED and booking becomes CONFIRMED', async () => {
    const { startAt, endAt } = createAvailableSlot(120);
    const seeded = await prisma.visitSlot.create({
      data: {
        propertyId: paidPropertyId,
        startAt,
        endAt,
        status: 'AVAILABLE',
        source: 'TEMPLATE',
      },
    });
    createdSlotIds.push(seeded.id);

    const booking = await slots.bookVisit(tenantUserId, {
      slotId: seeded.id,
      propertyId: paidPropertyId,
    });
    createdBookingIds.push(booking.id);

    const confirmed = await slots.confirmVisit(ownerUserId, booking.id);
    expect(confirmed.status).toBe('CONFIRMED');

    const slot = await prisma.visitSlot.findUnique({
      where: { id: seeded.id },
    });
    expect(slot?.status).toBe('BOOKED');
  });

  it('cancels a booking and frees the slot', async () => {
    const { startAt, endAt } = createAvailableSlot(144);
    const seeded = await prisma.visitSlot.create({
      data: {
        propertyId: freePropertyId,
        startAt,
        endAt,
        status: 'AVAILABLE',
        source: 'TEMPLATE',
      },
    });
    createdSlotIds.push(seeded.id);

    const booking = await slots.bookVisit(tenantUserId, {
      slotId: seeded.id,
      propertyId: freePropertyId,
    });
    createdBookingIds.push(booking.id);

    const cancelled = await slots.cancelVisit(tenantUserId, booking.id);
    expect(cancelled.status).toBe('CANCELLED');

    const slot = await prisma.visitSlot.findUnique({
      where: { id: seeded.id },
    });
    expect(slot?.status).toBe('AVAILABLE');
  });
});
