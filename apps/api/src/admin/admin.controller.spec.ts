import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { AdminModule } from './admin.module';

/**
 * Admin e2e tests — exercise the three production endpoints:
 *  - GET    /admin/users
 *  - GET    /admin/stats
 *  - PATCH  /admin/properties/:id/moderate
 *
 * Auth model: in test mode, `x-test-user` / `x-test-roles` headers
 * populate the request (see `AppAuthGuard` + `RolesGuard`). The admin
 * routes require the global `PLATFORM_ADMIN` role.
 */
describe('Admin (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminUserId: string;
  let tenantUserId: string;
  let ownerUserId: string;
  let ownerOrgId: string;
  let propertyId: string;
  let secondPropertyId: string;
  let activeLeaseId: string;
  let overdueScheduleId: string;
  let countryId: string;
  let bzvQuartierId: string;
  const createdUserIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AdminModule],
    })
      .overrideProvider(EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true }),
    );
    await app.init();

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

    // Cleanup leftover users / properties from previous runs.
    const leftover = await prisma.user.findMany({
      where: {
        phone: {
          in: ['+242070000111', '+242070000112', '+242070000113'],
        },
      },
      select: { id: true },
    });
    if (leftover.length > 0) {
      const ids = leftover.map((u) => u.id);
      await prisma.notification
        .deleteMany({ where: { userId: { in: ids } } })
        .catch(() => undefined);
      await prisma.userRole.deleteMany({
        where: { userId: { in: ids } },
      });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: ids } },
      });
      // Detach properties owned by these users (delete cascades chains).
      await prisma.property.deleteMany({
        where: { ownerId: { in: ids } },
      });
      await prisma.user.deleteMany({ where: { id: { in: ids } } });
    }

    const admin = await prisma.user.create({
      data: {
        phone: '+242070000111',
        countryId,
        roles: { create: { role: 'PLATFORM_ADMIN' } },
      },
    });
    adminUserId = admin.id;
    createdUserIds.push(adminUserId);

    const tenant = await prisma.user.create({
      data: {
        phone: '+242070000112',
        countryId,
        name: 'Admin Test Tenant',
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
    createdUserIds.push(tenantUserId);

    const owner = await prisma.user.create({
      data: {
        phone: '+242070000113',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    createdUserIds.push(ownerUserId);

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Admin Test Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    ownerOrgId = ownerOrg.id;

    const mkProperty = (suffix: string) =>
      prisma.property.create({
        data: {
          title: `Admin Test Property ${suffix}`,
          description: 'Pour tester la modération admin',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 150000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'X',
          countryId,
          ownerId: ownerUserId,
          organizationId: ownerOrgId,
        },
      });

    const p1 = await mkProperty('A');
    propertyId = p1.id;
    const p2 = await mkProperty('B');
    secondPropertyId = p2.id;

    const lease = await prisma.lease.create({
      data: {
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date('2026-06-01T00:00:00Z'),
        endDate: new Date('2027-06-01T00:00:00Z'),
        monthlyRent: new Prisma.Decimal(150000),
        deposit: new Prisma.Decimal(300000),
        currency: 'XAF',
        status: 'ACTIVE',
      },
    });
    activeLeaseId = lease.id;

    const overdue = await prisma.rentSchedule.create({
      data: {
        leaseId: activeLeaseId,
        dueDate: new Date('2026-05-01T00:00:00Z'),
        amount: new Prisma.Decimal(150000),
        currency: 'XAF',
        status: 'OVERDUE',
      },
    });
    overdueScheduleId = overdue.id;
  });

  afterAll(async () => {
    // Notification FK RESTRICT cleanup first.
    await prisma.notification
      .deleteMany({ where: { userId: { in: createdUserIds } } })
      .catch(() => undefined);
    await prisma.paymentAllocation
      .deleteMany({ where: { rentScheduleId: overdueScheduleId } })
      .catch(() => undefined);
    await prisma.rentSchedule
      .deleteMany({ where: { id: overdueScheduleId } })
      .catch(() => undefined);
    await prisma.lease
      .deleteMany({ where: { id: activeLeaseId } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: { in: [propertyId, secondPropertyId] } } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.organization
      .delete({ where: { id: ownerOrgId } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({
      where: { userId: { in: createdUserIds } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: createdUserIds } },
    });
    await app.close();
    await prisma.onModuleDestroy();
  });

  // ------------------------------------------------------------------
  // AuthZ
  // ------------------------------------------------------------------

  it('returns 403 when the caller is not PLATFORM_ADMIN (GET /stats)', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(403);
    const body = res.body as { message?: string };
    expect(body.message ?? '').toContain('PLATFORM_ADMIN');
  });

  it('returns 403 when the caller is not PLATFORM_ADMIN (GET /users)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/admin/users')
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .expect(403);
  });

  it('returns 401 when there is no auth (GET /users)', async () => {
    await request(app.getHttpServer()).get('/api/v1/admin/users').expect(401);
  });

  // ------------------------------------------------------------------
  // Stats
  // ------------------------------------------------------------------

  it('returns aggregates for a PLATFORM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/stats')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);

    const body = res.body as {
      statusCode: number;
      data: {
        totalUsers: number;
        totalProperties: number;
        activeLeases: number;
        overdueSchedules: number;
      };
    };
    expect(body.statusCode).toBe(200);
    // We just created 3 users, 2 properties, 1 active lease, 1 overdue schedule.
    // The exact totals depend on prior test data, but we can assert ≥ our
    // contribution is reflected.
    expect(body.data.totalUsers).toBeGreaterThanOrEqual(3);
    expect(body.data.totalProperties).toBeGreaterThanOrEqual(2);
    expect(body.data.activeLeases).toBeGreaterThanOrEqual(1);
    expect(body.data.overdueSchedules).toBeGreaterThanOrEqual(1);
  });

  // ------------------------------------------------------------------
  // Users list
  // ------------------------------------------------------------------

  it('lists users paginated for a PLATFORM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/admin/users?pageSize=10')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .expect(200);
    const body = res.body as {
      data: Array<{ id: string; phone: string; roles: string[] }>;
      meta: { total: number; page: number; pageSize: number };
    };
    expect(body.data.length).toBeGreaterThanOrEqual(3);
    const me = body.data.find((u) => u.id === adminUserId);
    expect(me).toBeDefined();
    expect(me?.roles).toContain('PLATFORM_ADMIN');
    expect(body.meta.pageSize).toBe(10);
    expect(body.meta.total).toBeGreaterThanOrEqual(3);
  });

  // ------------------------------------------------------------------
  // Moderation
  // ------------------------------------------------------------------

  it('flips property status to PAUSED for a PLATFORM_ADMIN', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${propertyId}/moderate`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'PAUSED', reason: 'Spam report' })
      .expect(200);

    const body = res.body as { data: { id: string; status: string } };
    expect(body.data.id).toBe(propertyId);
    expect(body.data.status).toBe('PAUSED');

    const after = await prisma.property.findUnique({
      where: { id: propertyId },
    });
    expect(after?.status).toBe('PAUSED');
  });

  it('rejects an invalid target status with 400', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${secondPropertyId}/moderate`)
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'BOGUS' })
      .expect(400);
  });

  it('returns 404 when moderating a non-existent property', async () => {
    await request(app.getHttpServer())
      .patch('/api/v1/admin/properties/does-not-exist/moderate')
      .set('x-test-user', adminUserId)
      .set('x-test-roles', 'PLATFORM_ADMIN')
      .send({ status: 'PAUSED' })
      .expect(404);
  });

  it('rejects moderation from a non-admin with 403', async () => {
    await request(app.getHttpServer())
      .patch(`/api/v1/admin/properties/${secondPropertyId}/moderate`)
      .set('x-test-user', tenantUserId)
      .set('x-test-roles', 'TENANT')
      .send({ status: 'PAUSED' })
      .expect(403);
  });
});
