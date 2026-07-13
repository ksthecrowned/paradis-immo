import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { VisitSlotsService } from './visit-slots.service';

describe('VisitSlotsService — manual open/unblock', () => {
  let slots: VisitSlotsService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let propertyId: string;
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

    await prisma.user.deleteMany({ where: { phone: '+242071000011' } });
    const owner = await prisma.user.create({
      data: {
        phone: '+242071000011',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Visit Manual Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Visit Manual Open',
        description: 'Open/unblock tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Y',
        countryId,
        ownerId: ownerUserId,
        organizationId: ownerOrg.id,
        visitEnabled: true,
        visitType: 'FREE',
        visitDuration: 30,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    if (createdSlotIds.length) {
      await prisma.visitSlot
        .deleteMany({ where: { id: { in: createdSlotIds } } })
        .catch(() => undefined);
    }
    await prisma.visitSlot
      .deleteMany({ where: { propertyId } })
      .catch(() => undefined);
    await prisma.property
      .delete({ where: { id: propertyId } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { userId: ownerUserId } })
      .catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { members: { none: {} } } })
      .catch(() => undefined);
    await prisma.userRole
      .deleteMany({ where: { userId: ownerUserId } })
      .catch(() => undefined);
    await prisma.user
      .delete({ where: { id: ownerUserId } })
      .catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  it('openSlot creates AVAILABLE MANUAL slot', async () => {
    const startAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const slot = await slots.openSlot(ownerUserId, propertyId, {
      startAt,
      endAt,
    });
    createdSlotIds.push(slot.id);
    expect(slot.status).toBe('AVAILABLE');
    expect(slot.source).toBe('MANUAL');
  });

  it('openSlot rejects BOOKED conflict', async () => {
    const startAt = new Date(Date.now() + 4 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const booked = await prisma.visitSlot.create({
      data: {
        propertyId,
        startAt,
        endAt,
        status: 'BOOKED',
        source: 'MANUAL',
      },
    });
    createdSlotIds.push(booked.id);
    await expect(
      slots.openSlot(ownerUserId, propertyId, { startAt, endAt }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('unblockSlot flips BLOCKED to AVAILABLE', async () => {
    const startAt = new Date(Date.now() + 5 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const blocked = await slots.blockSlot(ownerUserId, propertyId, {
      startAt,
      endAt,
    });
    createdSlotIds.push(blocked.id);
    const opened = await slots.unblockSlot(ownerUserId, blocked.id);
    expect(opened.status).toBe('AVAILABLE');
  });

  it('unblockSlot rejects non-BLOCKED', async () => {
    const startAt = new Date(Date.now() + 6 * 24 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const slot = await slots.openSlot(ownerUserId, propertyId, {
      startAt,
      endAt,
    });
    createdSlotIds.push(slot.id);
    await expect(
      slots.unblockSlot(ownerUserId, slot.id),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('listManagedSlots returns AVAILABLE BLOCKED and BOOKED', async () => {
    const base = Date.now() + 7 * 24 * 60 * 60 * 1000;
    const mk = async (
      offsetH: number,
      status: 'AVAILABLE' | 'BLOCKED' | 'BOOKED',
    ) => {
      const startAt = new Date(base + offsetH * 3600_000);
      startAt.setUTCSeconds(0, 0);
      const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
      const row = await prisma.visitSlot.create({
        data: {
          propertyId,
          startAt,
          endAt,
          status,
          source: 'MANUAL',
        },
      });
      createdSlotIds.push(row.id);
      return row;
    };
    await mk(0, 'AVAILABLE');
    await mk(1, 'BLOCKED');
    await mk(2, 'BOOKED');

    const listed = await slots.listManagedSlots(ownerUserId, propertyId, {
      from: new Date(base - 60_000),
    });
    const statuses = new Set(listed.map((s) => s.status));
    expect(statuses.has('AVAILABLE')).toBe(true);
    expect(statuses.has('BLOCKED')).toBe(true);
    expect(statuses.has('BOOKED')).toBe(true);
  });
});
