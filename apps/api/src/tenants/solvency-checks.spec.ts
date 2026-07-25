import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { AgencyAccessService } from '../mandates/agency-access.service';
import { EventPublisher } from '../events/event.publisher';
import { DOMAIN_EVENTS } from '../events/event.types';
import { SolvencyChecksService } from './solvency-checks.service';

describe('SolvencyChecksService', () => {
  let svc: SolvencyChecksService;
  let prisma: PrismaService;
  let emit: jest.Mock;

  let countryId: string;
  let quartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let strangerUserId: string;
  let orgId: string;
  let propertyId: string;
  let leaseId: string;
  const scheduleIds: string[] = [];
  const paymentIds: string[] = [];
  const phones = ['+242073000001', '+242073000002', '+242073000003'];

  beforeAll(async () => {
    emit = jest.fn().mockResolvedValue(undefined);
    const moduleRef = await Test.createTestingModule({
      providers: [
        SolvencyChecksService,
        PrismaService,
        AgencyAccessService,
        { provide: EventPublisher, useValue: { emit } },
      ],
    }).compile();
    svc = moduleRef.get(SolvencyChecksService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Run seed first');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Run seed first');
    quartierId = quartier.id;

    const stale = await prisma.user.findMany({
      where: { phone: { in: phones } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.solvencyCheck.deleteMany({
        where: { tenantUserId: { in: staleIds } },
      });
      const leases = await prisma.lease.findMany({
        where: { tenantId: { in: staleIds } },
        select: { id: true },
      });
      const leaseIds = leases.map((l) => l.id);
      if (leaseIds.length) {
        await prisma.paymentAllocation.deleteMany({
          where: { rentSchedule: { leaseId: { in: leaseIds } } },
        });
        await prisma.rentSchedule.deleteMany({
          where: { leaseId: { in: leaseIds } },
        });
        await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
      }
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        name: 'Owner Solvency',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    const tenant = await prisma.user.create({
      data: {
        phone: phones[1],
        name: 'Tenant Solvency',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;

    const stranger = await prisma.user.create({
      data: {
        phone: phones[2],
        name: 'Stranger Solvency',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    strangerUserId = stranger.id;

    const org = await prisma.organization.create({
      data: {
        name: `Solvency Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Solvency Property',
        description: 'x',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'x',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
      },
    });
    propertyId = prop.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2026-12-31T00:00:00Z'),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    leaseId = lease.id;

    const dues = [
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-02-01T00:00:00Z'),
      new Date('2026-03-01T00:00:00Z'),
      new Date('2026-04-01T00:00:00Z'),
    ];
    const paidAts = [
      new Date('2026-01-01T00:00:00Z'),
      new Date('2026-02-06T00:00:00Z'),
      new Date('2026-03-01T00:00:00Z'),
      new Date('2026-04-03T00:00:00Z'),
    ];

    for (let i = 0; i < dues.length; i++) {
      const schedule = await prisma.rentSchedule.create({
        data: {
          leaseId,
          dueDate: dues[i]!,
          amount: 100000,
          currency: 'XAF',
          status: 'PAID',
        },
      });
      scheduleIds.push(schedule.id);

      const payment = await prisma.payment.create({
        data: {
          userId: tenantUserId,
          amount: 100000,
          currency: 'XAF',
          method: 'CASH',
          status: 'VALIDATED',
          reference: `solv-ref-${Date.now()}-${i}`,
          idempotencyKey: `solv-idem-${Date.now()}-${i}`,
          validatedAt: paidAts[i]!,
        },
      });
      paymentIds.push(payment.id);
      await prisma.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          type: 'RENT_SCHEDULE',
          refId: schedule.id,
          amount: 100000,
          rentScheduleId: schedule.id,
        },
      });
    }
  });

  afterEach(async () => {
    await prisma.solvencyCheck.deleteMany({
      where: { tenantUserId },
    });
    emit.mockClear();
  });

  afterAll(async () => {
    await prisma.solvencyCheck.deleteMany({ where: { tenantUserId } });
    if (paymentIds.length) {
      await prisma.paymentAllocation.deleteMany({
        where: { paymentId: { in: paymentIds } },
      });
      await prisma.payment.deleteMany({ where: { id: { in: paymentIds } } });
    }
    if (scheduleIds.length) {
      await prisma.rentSchedule.deleteMany({
        where: { id: { in: scheduleIds } },
      });
    }
    await prisma.lease.deleteMany({ where: { id: leaseId } });
    await prisma.property.deleteMany({ where: { id: propertyId } });
    await prisma.organizationMember.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.organization.deleteMany({ where: { id: orgId } });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, strangerUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, tenantUserId, strangerUserId] } },
    });
    await prisma.onModuleDestroy();
  });

  it('creates a PENDING check and emits event', async () => {
    const created = await svc.create(ownerUserId, tenantUserId);
    expect(created.status).toBe('PENDING');
    expect(created.snapshot).toBeNull();
    expect(emit).toHaveBeenCalledWith(
      DOMAIN_EVENTS.SOLVENCY_CHECK_REQUESTED,
      expect.objectContaining({
        checkId: created.id,
        tenantUserId,
        requesterOrgId: orgId,
      }),
    );
  });

  it('rejects create when no PAID rents', async () => {
    await prisma.rentSchedule.updateMany({
      where: { id: { in: scheduleIds } },
      data: { status: 'PENDING' },
    });
    await expect(svc.create(ownerUserId, tenantUserId)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await prisma.rentSchedule.updateMany({
      where: { id: { in: scheduleIds } },
      data: { status: 'PAID' },
    });
  });

  it('rejects second PENDING for same org/tenant', async () => {
    await svc.create(ownerUserId, tenantUserId);
    await expect(svc.create(ownerUserId, tenantUserId)).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('accepts and builds snapshot of last 3 with daysLate', async () => {
    const created = await svc.create(ownerUserId, tenantUserId);
    const granted = await svc.respond(tenantUserId, created.id, true);
    expect(granted.status).toBe('GRANTED');
    expect(granted.snapshot).toHaveLength(3);
    expect(granted.expiresAt).toBeTruthy();
    const expires = new Date(granted.expiresAt!);
    const deltaDays =
      (expires.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    expect(deltaDays).toBeGreaterThan(6.5);
    expect(deltaDays).toBeLessThan(7.5);

    // Latest by dueDate: Apr (2 late), Mar (0), Feb (5)
    expect(granted.snapshot![0]!.dueDate).toBe('2026-04-01');
    expect(granted.snapshot![0]!.daysLate).toBe(2);
    expect(granted.snapshot![1]!.daysLate).toBe(0);
    expect(granted.snapshot![2]!.daysLate).toBe(5);

    const latest = await svc.latestForOrg(ownerUserId, tenantUserId);
    expect(latest?.status).toBe('GRANTED');
    expect(latest?.snapshot).toHaveLength(3);
  });

  it('denies without exposing snapshot to owner', async () => {
    const created = await svc.create(ownerUserId, tenantUserId);
    await svc.respond(tenantUserId, created.id, false);
    const latest = await svc.latestForOrg(ownerUserId, tenantUserId);
    expect(latest?.status).toBe('DENIED');
    expect(latest?.snapshot).toBeNull();
  });

  it('marks EXPIRED on latest when expiresAt passed', async () => {
    const created = await svc.create(ownerUserId, tenantUserId);
    await svc.respond(tenantUserId, created.id, true);
    await prisma.solvencyCheck.update({
      where: { id: created.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });
    const latest = await svc.latestForOrg(ownerUserId, tenantUserId);
    expect(latest?.status).toBe('EXPIRED');
    expect(latest?.snapshot).toBeNull();
  });

  it('rejects stranger manager', async () => {
    await expect(
      svc.create(strangerUserId, tenantUserId),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
