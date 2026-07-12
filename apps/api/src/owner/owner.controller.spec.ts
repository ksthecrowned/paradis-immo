import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerModule } from './owner.module';

describe('Owner stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerUserId: string;
  let strangerUserId: string;
  let countryId: string;
  let quartierId: string;
  let orgId: string;
  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdSlotIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [OwnerModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    if (!cg) throw new Error('Seed CG country required');
    countryId = cg.id;
    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Seed quartier required');
    quartierId = quartier.id;

    const suffix = String(Date.now()).slice(-7);
    const owner = await prisma.user.create({
      data: {
        phone: `+24207${suffix}1`,
        countryId,
        name: 'Owner Stats Owner',
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    createdUserIds.push(owner.id);

    const stranger = await prisma.user.create({
      data: {
        phone: `+24207${suffix}2`,
        countryId,
        name: 'Owner Stats Stranger',
        roles: { create: { role: 'TENANT' } },
      },
    });
    strangerUserId = stranger.id;
    createdUserIds.push(stranger.id);

    const org = await prisma.organization.create({
      data: {
        name: `Owner Stats Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.visitBooking
      .deleteMany({ where: { id: { in: createdBookingIds } } })
      .catch(() => undefined);
    await prisma.visitSlot
      .deleteMany({ where: { id: { in: createdSlotIds } } })
      .catch(() => undefined);
    await prisma.paymentAllocation
      .deleteMany({ where: { paymentId: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.payment
      .deleteMany({ where: { id: { in: createdPaymentIds } } })
      .catch(() => undefined);
    await prisma.rentSchedule
      .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.lease
      .deleteMany({ where: { id: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: { in: createdPropertyIds } } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({ where: { organizationId: orgId } })
      .catch(() => undefined);
    await prisma.organization
      .delete({ where: { id: orgId } })
      .catch(() => undefined);
    await prisma.userRole
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => undefined);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/owner/stats').expect(401);
  });

  it('returns zeros for authenticated user with empty portfolio', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/owner/stats')
      .set('x-test-user', strangerUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(res.body).toEqual({
      activeProperties: 0,
      activeLeases: 0,
      pendingPayments: 0,
      pendingVisitRequests: 0,
    });
  });

  it('counts active properties, leases, pending payments, pending visits', async () => {
    const prop = await prisma.property.create({
      data: {
        title: 'Owner Stats Prop',
        description: 'stats fixture',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'Test',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
        status: 'ACTIVE',
      },
    });
    createdPropertyIds.push(prop.id);

    const draft = await prisma.property.create({
      data: {
        title: 'Owner Stats Draft',
        description: 'ignored',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 1,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId,
        address: 'Test',
        countryId,
        ownerId: ownerUserId,
        organizationId: orgId,
        status: 'DRAFT',
      },
    });
    createdPropertyIds.push(draft.id);

    const lease = await prisma.lease.create({
      data: {
        propertyId: prop.id,
        tenantId: strangerUserId,
        status: 'ACTIVE',
        startDate: new Date('2026-01-01T00:00:00Z'),
        endDate: new Date('2027-01-01T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(100000),
        deposit: new Prisma.Decimal(0),
        currency: 'XAF',
      },
    });
    createdLeaseIds.push(lease.id);

    const schedule = await prisma.rentSchedule.create({
      data: {
        leaseId: lease.id,
        dueDate: new Date('2026-01-01T00:00:00Z'),
        amount: new Prisma.Decimal(100000),
        currency: 'XAF',
        status: 'PENDING',
      },
    });

    const pendingPay = await prisma.payment.create({
      data: {
        userId: strangerUserId,
        amount: new Prisma.Decimal(100000),
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        status: 'PENDING_VALIDATION',
        reference: `own-stats-${Date.now()}`,
        idempotencyKey: `own-stats-${Date.now()}`,
      },
    });
    createdPaymentIds.push(pendingPay.id);
    await prisma.paymentAllocation.create({
      data: {
        paymentId: pendingPay.id,
        type: 'RENT_SCHEDULE',
        refId: schedule.id,
        rentScheduleId: schedule.id,
        amount: new Prisma.Decimal(100000),
      },
    });

    const failedPay = await prisma.payment.create({
      data: {
        userId: strangerUserId,
        amount: new Prisma.Decimal(50000),
        currency: 'XAF',
        method: 'MOBILE_MONEY',
        status: 'FAILED',
        reference: `own-stats-fail-${Date.now()}`,
        idempotencyKey: `own-stats-fail-${Date.now()}`,
      },
    });
    createdPaymentIds.push(failedPay.id);
    await prisma.paymentAllocation.create({
      data: {
        paymentId: failedPay.id,
        type: 'RENT_SCHEDULE',
        refId: schedule.id,
        rentScheduleId: schedule.id,
        amount: new Prisma.Decimal(50000),
      },
    });

    const startAt = new Date(Date.now() + 86_400_000);
    const slot = await prisma.visitSlot.create({
      data: {
        propertyId: prop.id,
        startAt,
        endAt: new Date(startAt.getTime() + 1_800_000),
        status: 'AVAILABLE',
        source: 'MANUAL',
      },
    });
    createdSlotIds.push(slot.id);
    const booking = await prisma.visitBooking.create({
      data: {
        slotId: slot.id,
        propertyId: prop.id,
        userId: strangerUserId,
        status: 'PENDING',
      },
    });
    createdBookingIds.push(booking.id);

    const res = await request(app.getHttpServer())
      .get('/api/v1/owner/stats')
      .set('x-test-user', ownerUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);

    expect(res.body).toEqual({
      activeProperties: 1,
      activeLeases: 1,
      pendingPayments: 1,
      pendingVisitRequests: 1,
    });
  });
});
