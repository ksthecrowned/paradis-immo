import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { LeasesService } from './leases.service';
import { RentScheduleGenerator } from './rent-schedule.generator.service';
import { generateRentSchedule } from './rent-schedule.generator';

describe('RentScheduleGenerator (unit)', () => {
  it('generates one entry per month from startDate to endDate', () => {
    const entries = generateRentSchedule({
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-06-01T00:00:00Z'),
      monthlyRent: '150000',
      currency: 'XAF',
    });
    expect(entries).toHaveLength(6);
    expect(entries[0].dueDate).toEqual(new Date('2026-01-01T00:00:00Z'));
    expect(entries[5].dueDate).toEqual(new Date('2026-06-01T00:00:00Z'));
    expect(
      entries.every((e) => e.amount === '150000' && e.currency === 'XAF'),
    ).toBe(true);
  });

  it('skips the entry if endDate is on or before the first dueDate', () => {
    const entries = generateRentSchedule({
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2025-12-15T00:00:00Z'),
      monthlyRent: '100000',
      currency: 'XAF',
    });
    expect(entries).toHaveLength(0);
  });
});

describe('LeasesService — schedule generation', () => {
  let leases: LeasesService;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let propertyId: string;
  const createdLeaseIds: string[] = [];
  const emittedEvents: Array<{ name: string; payload: unknown }> = [];

  beforeAll(async () => {
    const eventBus: Pick<EventPublisher, 'emit'> = {
      // eslint-disable-next-line @typescript-eslint/require-await
      emit: jest.fn(async (name, payload) => {
        emittedEvents.push({ name, payload });
        return { id: 'mock', name };
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        LeasesService,
        RentScheduleGenerator,
        PrismaService,
        { provide: EventPublisher, useValue: eventBus },
      ],
    }).compile();
    leases = moduleRef.get(LeasesService);
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
      where: { phone: { in: ['+242070000001', '+242070000002'] } },
    });
    const owner = await prisma.user.create({
      data: {
        phone: '+242070000001',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const tenant = await prisma.user.create({
      data: {
        phone: '+242070000002',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const org = await prisma.organization.create({
      data: {
        name: `Lease Test Owner ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Lease Test Property',
        description: 'Pour tester les baux',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
        ownerId: ownerUserId,
        organizationId: org.id,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    if (createdLeaseIds.length) {
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
        .catch(() => undefined);
      await prisma.lease
        .deleteMany({ where: { id: { in: createdLeaseIds } } })
        .catch(() => undefined);
    }
    await prisma.property
      .delete({ where: { id: propertyId } })
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

  beforeEach(() => {
    emittedEvents.length = 0;
  });

  it('activates a lease and generates 6 monthly rent entries (Jan-Jun 2026)', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2026-01-01T00:00:00Z'),
      endDate: new Date('2026-06-30T00:00:00Z'),
      monthlyRent: '150000',
      currency: 'XAF',
      deposit: '300000',
    });
    createdLeaseIds.push(lease.id);

    expect(lease.status).toBe('DRAFT');

    const activated = await leases.activateLease(ownerUserId, lease.id);
    expect(activated.status).toBe('ACTIVE');

    const schedule = await prisma.rentSchedule.findMany({
      where: { leaseId: lease.id },
      orderBy: { dueDate: 'asc' },
    });
    expect(schedule).toHaveLength(6);
    expect(schedule[0].dueDate.toISOString()).toContain('2026-01-01');
    expect(schedule[5].dueDate.toISOString()).toContain('2026-06-01');
    expect(schedule.every((s) => s.status === 'PENDING')).toBe(true);

    // LEASE_CREATED event was emitted on activation.
    expect(emittedEvents.find((e) => e.name === 'lease.created')).toBeDefined();
  });

  it('idempotent: activating twice does not duplicate schedule entries', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2026-07-01T00:00:00Z'),
      endDate: new Date('2026-09-30T00:00:00Z'),
      monthlyRent: '100000',
      currency: 'XAF',
      deposit: '200000',
    });
    createdLeaseIds.push(lease.id);

    await leases.activateLease(ownerUserId, lease.id);
    await leases.activateLease(ownerUserId, lease.id);
    const schedule = await prisma.rentSchedule.findMany({
      where: { leaseId: lease.id },
    });
    // 3 months: Jul, Aug, Sep
    expect(schedule).toHaveLength(3);
  });

  it('listManaged returns leases for properties the user owns or manages', async () => {
    const lease = await leases.createLease(ownerUserId, {
      propertyId,
      tenantId: tenantUserId,
      startDate: new Date('2026-10-01T00:00:00Z'),
      endDate: new Date('2026-12-31T00:00:00Z'),
      monthlyRent: '120000',
      currency: 'XAF',
      deposit: '240000',
    });
    createdLeaseIds.push(lease.id);

    const managed = await leases.listManaged(ownerUserId, {});
    expect(Array.isArray(managed)).toBe(true);
    const found = managed.find((l) => l.id === lease.id);
    expect(found).toBeDefined();
    expect(found?.propertyId).toBe(propertyId);
    expect(found?.tenantId).toBe(tenantUserId);
    expect(found?.status).toBe('DRAFT');
  });
});
