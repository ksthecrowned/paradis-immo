import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { VisitSlotGenerator, generateSlotsForProperty } from './slot-generator';

describe('VisitSlotGenerator (unit)', () => {
  it('splits a Mon 9:00-12:00 / 30min range into 6 slots on the right weekday', () => {
    // Pin "now" so the generator is deterministic
    const monday = new Date('2026-06-29T00:00:00Z'); // Monday
    const slots = generateSlotsForProperty(
      [
        {
          id: 'tpl1',
          propertyId: 'p1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '12:00',
          slotMinutes: 30,
          active: true,
          createdAt: new Date(),
        },
      ],
      14,
      monday,
    );

    // Expect 6 slots/day on the first matching Monday.
    const mondaySlots = slots.filter((s) =>
      s.startAt.toISOString().startsWith('2026-06-29T'),
    );
    expect(mondaySlots).toHaveLength(6);
    expect(mondaySlots[0].startAt.toISOString()).toContain('T09:00:00');
    expect(mondaySlots[5].startAt.toISOString()).toContain('T11:30:00');
    expect(mondaySlots[5].endAt.toISOString()).toContain('T12:00:00');
  });

  it('skips inactive templates', () => {
    const monday = new Date('2026-06-29T00:00:00Z');
    const slots = generateSlotsForProperty(
      [
        {
          id: 'tpl1',
          propertyId: 'p1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '10:00',
          slotMinutes: 30,
          active: false,
          createdAt: new Date(),
        },
      ],
      7,
      monday,
    );
    expect(slots).toHaveLength(0);
  });

  it('produces zero slots when the time range is shorter than slotMinutes', () => {
    const monday = new Date('2026-06-29T00:00:00Z');
    const slots = generateSlotsForProperty(
      [
        {
          id: 'tpl1',
          propertyId: 'p1',
          dayOfWeek: 1,
          startTime: '09:00',
          endTime: '09:15',
          slotMinutes: 30,
          active: true,
          createdAt: new Date(),
        },
      ],
      7,
      monday,
    );
    expect(slots).toHaveLength(0);
  });
});

describe('VisitSlotGenerator (e2e)', () => {
  let generator: VisitSlotGenerator;
  let prisma: PrismaService;
  let propertyId: string;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  const generatedSlots: string[] = [];
  const manualBlocks: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        VisitSlotGenerator,
        PrismaService,
        { provide: EventPublisher, useValue: { emit: jest.fn() } },
      ],
    }).compile();
    generator = moduleRef.get(VisitSlotGenerator);
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

    await prisma.user.deleteMany({ where: { phone: '+242078888888' } });
    const owner = await prisma.user.create({
      data: {
        phone: '+242078888888',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Slot Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Slot Test Property',
        description: 'Pour tester les slots',
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
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    if (generatedSlots.length) {
      await prisma.visitSlot
        .deleteMany({ where: { id: { in: generatedSlots } } })
        .catch(() => undefined);
    }
    await prisma.visitSlot
      .deleteMany({
        where: { propertyId, source: 'MANUAL', status: 'BLOCKED' },
      })
      .catch(() => undefined);
    void manualBlocks;
    await prisma.visitSlotTemplate
      .deleteMany({ where: { propertyId } })
      .catch(() => undefined);
    await prisma.property
      .delete({ where: { id: propertyId } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: ownerUserId },
    });
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: ownerUserId } });
    await prisma.user.deleteMany({ where: { id: ownerUserId } });
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.visitSlotTemplate.deleteMany({ where: { propertyId } });
    await prisma.visitSlot.deleteMany({ where: { propertyId } });
  });

  it('generator creates 6 slots on the first matching day from a Mon 9-12 template', async () => {
    // Pin "now" via the explicit `now` parameter of the service.
    const monday = new Date('2026-06-29T00:00:00.000Z');

    await prisma.visitSlotTemplate.create({
      data: {
        propertyId,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
        slotMinutes: 30,
        active: true,
      },
    });

    const created = await generator.generateForProperty(propertyId, 14, monday);
    generatedSlots.push(...created.map((s) => s.id));
    // 14-day horizon starting on Monday = 2 Mondays (29-Jun, 6-Jul) × 6 slots = 12
    expect(created).toHaveLength(12);

    // Verify they fall on Mondays starting 09:00
    const first = created[0];
    expect(first.startAt.toISOString()).toContain('2026-06-29T09:00:00');
    expect(first.endAt.toISOString()).toContain('T09:30:00');
    expect(first.status).toBe('AVAILABLE');

    // Every slot must start on the configured weekday
    created.forEach((s) => {
      expect(new Date(s.startAt).getUTCDay()).toBe(1);
    });
  });

  it('manually BLOCKED slots are excluded from available listings', async () => {
    // Add a manual block in the future
    const blockAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days ahead
    blockAt.setUTCHours(10, 0, 0, 0);
    const blockEnd = new Date(blockAt.getTime() + 30 * 60 * 1000);
    const blocked = await prisma.visitSlot.create({
      data: {
        propertyId,
        startAt: blockAt,
        endAt: blockEnd,
        status: 'BLOCKED',
        source: 'MANUAL',
      },
    });

    const available = await prisma.visitSlot.findMany({
      where: {
        propertyId,
        status: 'AVAILABLE',
        startAt: { gte: blockAt, lte: blockEnd },
      },
    });
    expect(available.find((s) => s.id === blocked.id)).toBeUndefined();

    // Cleanup
    await prisma.visitSlot.delete({ where: { id: blocked.id } });
  });

  it('idempotent: running generate twice does not duplicate slots', async () => {
    const monday = new Date('2026-06-29T00:00:00.000Z');

    // Create a template (beforeEach already cleared templates + slots)
    await prisma.visitSlotTemplate.create({
      data: {
        propertyId,
        dayOfWeek: 1,
        startTime: '09:00',
        endTime: '12:00',
        slotMinutes: 30,
        active: true,
      },
    });

    await generator.generateForProperty(propertyId, 14, monday);
    const firstCount = await prisma.visitSlot.count({ where: { propertyId } });

    await generator.generateForProperty(propertyId, 14, monday);
    const secondCount = await prisma.visitSlot.count({ where: { propertyId } });

    expect(firstCount).toBe(12);
    expect(secondCount).toBe(12);
  });
});
