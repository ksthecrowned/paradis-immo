import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgentModule } from './agent.module';
import { brazzavilleDayBounds } from './agent-stats.service';

describe('Agent stats (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let quartierId: string;
  let ownerUserId: string;
  let gerantUserId: string;
  let assignedAgentId: string;
  let unassignedAgentId: string;
  let strangerUserId: string;
  let agencyOrgId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let mandateId: string;
  const createdUserIds: string[] = [];
  const createdPropertyIds: string[] = [];
  const createdLeaseIds: string[] = [];
  const createdBookingIds: string[] = [];
  const createdPaymentIds: string[] = [];
  const createdSlotIds: string[] = [];
  const createdTicketIds: string[] = [];
  const createdScheduleIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AgentModule],
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
        phone: `+24209${suffix}1`,
        countryId,
        name: 'Agent Stats Owner',
      },
    });
    ownerUserId = owner.id;
    createdUserIds.push(owner.id);

    const gerant = await prisma.user.create({
      data: {
        phone: `+24209${suffix}2`,
        countryId,
        name: 'Agent Stats Gerant',
      },
    });
    gerantUserId = gerant.id;
    createdUserIds.push(gerant.id);

    const assigned = await prisma.user.create({
      data: {
        phone: `+24209${suffix}3`,
        countryId,
        name: 'Agent Stats Assigned',
      },
    });
    assignedAgentId = assigned.id;
    createdUserIds.push(assigned.id);

    const unassigned = await prisma.user.create({
      data: {
        phone: `+24209${suffix}4`,
        countryId,
        name: 'Agent Stats Unassigned',
      },
    });
    unassignedAgentId = unassigned.id;
    createdUserIds.push(unassigned.id);

    const stranger = await prisma.user.create({
      data: {
        phone: `+24209${suffix}5`,
        countryId,
        name: 'Agent Stats Stranger',
      },
    });
    strangerUserId = stranger.id;
    createdUserIds.push(stranger.id);

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Agent Stats Owner Org ${suffix}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;

    const agency = await prisma.organization.create({
      data: {
        name: `Agent Stats Agency ${suffix}`,
        type: 'AGENCY',
        countryId,
        shortName: `as${suffix}`,
        members: {
          create: [
            { userId: gerantUserId, role: 'ADMIN' },
            { userId: assignedAgentId, role: 'AGENT' },
            { userId: unassignedAgentId, role: 'AGENT' },
          ],
        },
      },
    });
    agencyOrgId = agency.id;

    const prop = await prisma.property.create({
      data: {
        title: 'Agent Stats Prop',
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
        organizationId: ownerOrgId,
        status: 'ACTIVE',
      },
    });
    propertyId = prop.id;
    createdPropertyIds.push(prop.id);

    const mandate = await prisma.mandate.create({
      data: {
        propertyId,
        organizationId: agencyOrgId,
        assignedAgentId,
        status: 'ACTIVE',
      },
    });
    mandateId = mandate.id;
  });

  afterAll(async () => {
    await prisma.maintenanceTicket
      .deleteMany({ where: { id: { in: createdTicketIds } } })
      .catch(() => undefined);
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
      .deleteMany({ where: { id: { in: createdScheduleIds } } })
      .catch(() => undefined);
    await prisma.lease
      .deleteMany({ where: { id: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.mandate
      .deleteMany({ where: { id: mandateId } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: { in: createdPropertyIds } } })
      .catch(() => undefined);
    await prisma.organizationMember
      .deleteMany({
        where: { organizationId: { in: [agencyOrgId, ownerOrgId] } },
      })
      .catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { id: { in: [agencyOrgId, ownerOrgId] } } })
      .catch(() => undefined);
    await prisma.user
      .deleteMany({ where: { id: { in: createdUserIds } } })
      .catch(() => undefined);
    await app.close();
  });

  it('returns 401 without auth', async () => {
    await request(app.getHttpServer()).get('/api/v1/agent/stats').expect(401);
  });

  it('returns zeros for stranger with no operable properties', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/agent/stats')
      .set('x-test-user', strangerUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(res.body).toEqual({
      mandatedProperties: 0,
      visitsToday: 0,
      pendingCashValidations: 0,
      openMaintenanceTickets: 0,
    });
  });

  it('returns zeros for unassigned field agent', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/agent/stats')
      .set('x-test-user', unassignedAgentId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(res.body).toEqual({
      mandatedProperties: 0,
      visitsToday: 0,
      pendingCashValidations: 0,
      openMaintenanceTickets: 0,
    });
  });

  it('counts KPIs for assigned agent and gérant', async () => {
    const { start } = brazzavilleDayBounds();
    const slotStart = new Date(start.getTime() + 10 * 60 * 60 * 1000);

    const lease = await prisma.lease.create({
      data: {
        propertyId,
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
    createdScheduleIds.push(schedule.id);

    const pendingCash = await prisma.payment.create({
      data: {
        userId: strangerUserId,
        amount: new Prisma.Decimal(100000),
        currency: 'XAF',
        method: 'CASH',
        status: 'PENDING_VALIDATION',
        reference: `agent-stats-${Date.now()}`,
        idempotencyKey: `agent-stats-${Date.now()}`,
      },
    });
    createdPaymentIds.push(pendingCash.id);
    await prisma.paymentAllocation.create({
      data: {
        paymentId: pendingCash.id,
        type: 'RENT_SCHEDULE',
        refId: schedule.id,
        rentScheduleId: schedule.id,
        amount: new Prisma.Decimal(100000),
      },
    });

    const slot = await prisma.visitSlot.create({
      data: {
        propertyId,
        startAt: slotStart,
        endAt: new Date(slotStart.getTime() + 1_800_000),
        status: 'BOOKED',
        source: 'MANUAL',
      },
    });
    createdSlotIds.push(slot.id);
    const booking = await prisma.visitBooking.create({
      data: {
        slotId: slot.id,
        propertyId,
        userId: strangerUserId,
        status: 'CONFIRMED',
      },
    });
    createdBookingIds.push(booking.id);

    const ticket = await prisma.maintenanceTicket.create({
      data: {
        propertyId,
        reporterId: strangerUserId,
        title: 'Fuite',
        description: 'stats fixture',
        status: 'OPEN',
        priority: 'MEDIUM',
      },
    });
    createdTicketIds.push(ticket.id);

    const expected = {
      mandatedProperties: 1,
      visitsToday: 1,
      pendingCashValidations: 1,
      openMaintenanceTickets: 1,
    };

    const assignedRes = await request(app.getHttpServer())
      .get('/api/v1/agent/stats')
      .set('x-test-user', assignedAgentId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(assignedRes.body).toEqual(expected);

    const gerantRes = await request(app.getHttpServer())
      .get('/api/v1/agent/stats')
      .set('x-test-user', gerantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);
    expect(gerantRes.body).toEqual(expected);
  });
});
