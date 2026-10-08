import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LeasesModule } from './leases.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Spec 04 P1 — impayés (arrears).
 *
 * The board buckets overdue rent by age (0-30 / 31-60 / 60+), the deposit line
 * is not rent arrears, the balance is readable by the parties only, and the
 * manager can send a manual reminder — but never to an up-to-date tenant.
 */
describe('Leases HTTP — impayés (spec 04 P1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let outsiderUserId: string;
  let propertyId: string;
  const phones = {
    owner: '+242070000061',
    tenant: '+242070000062',
    outsider: '+242070000063',
  };
  const createdLeaseIds: string[] = [];
  const DAY = 86_400_000;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, LeasesModule],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalFilters(
      new (require('../common/filters/http-exception.filter').HttpExceptionFilter)(),
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

    const stale = await prisma.user.findMany({
      where: { phone: { in: Object.values(phones) } },
      select: { id: true },
    });
    if (stale.length) {
      await prisma.notification.deleteMany({
        where: { userId: { in: stale.map((u) => u.id) } },
      });
    }
    await prisma.user.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    const mk = async (phone: string, name: string) =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role: 'TENANT' } } },
      });
    ownerUserId = (await mk(phones.owner, 'Spec04 Arrears Owner')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec04 Arrears Tenant')).id;
    outsiderUserId = (await mk(phones.outsider, 'Spec04 Arrears Outsider')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec04 Arrears Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec04 Arrears Property',
          description: 'Impayés',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 100000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec04 Arrears',
          countryId,
          ownerId: ownerUserId,
          organizationId: org.id,
        },
      })
    ).id;
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
    await prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: 'AVAILABLE' },
    });
    await prisma.notification.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId] } },
    });
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, outsiderUserId] } },
    });
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, outsiderUserId] } },
    });
    await prisma.user
      .deleteMany({
        where: { id: { in: [ownerUserId, tenantUserId, outsiderUserId] } },
      })
      .catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  let leaseYear = 2040;

  /**
   * ACTIVE lease whose schedule is fully controlled: one line overdue by 70,
   * 40 and 10 days, one not due yet, one half paid, plus an unpaid DEPOSIT
   * line (which must never show up as rent arrears).
   */
  async function leaseWithArrears(): Promise<string> {
    leaseYear += 1;
    const created = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send({
        propertyId,
        invitedPhone: phones.tenant,
        startDate: `${leaseYear}-01-01`,
        endDate: `${leaseYear}-12-31`,
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
      })
      .expect(201);
    createdLeaseIds.push(created.body.id);
    const leaseId: string = created.body.id;

    await request(app.getHttpServer())
      .patch(`/api/v1/leases/${leaseId}/activate`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    await prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: 'AVAILABLE' },
    });

    await prisma.rentSchedule.deleteMany({ where: { leaseId } });
    const now = Date.now();
    const rent = (daysAgo: number, amount = 100000, paid = 0) =>
      prisma.rentSchedule.create({
        data: {
          leaseId,
          dueDate: new Date(now - daysAgo * DAY),
          kind: 'RENT',
          amount,
          currency: 'XAF',
          amountPaid: paid,
          status: paid > 0 ? 'PARTIAL' : 'OVERDUE',
        },
      });
    await rent(70);
    await rent(40);
    await rent(10);
    await rent(5, 100000, 60000); // half paid, still due
    await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date(now + 5 * DAY),
        kind: 'RENT',
        amount: 100000,
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    // Unpaid deposit, past due: excluded from arrears on purpose.
    await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date(now - 70 * DAY),
        kind: 'DEPOSIT',
        amount: 200000,
        currency: 'XAF',
        status: 'PENDING',
      },
    });
    return leaseId;
  }

  it('the board buckets overdue rent by age and leaves the deposit out', async () => {
    await leaseWithArrears();
    const res = await request(app.getHttpServer())
      .get('/api/v1/leases/arrears')
      .set('x-test-user', ownerUserId)
      .expect(200);

    expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20 });
    expect(res.body.data).toHaveLength(1);
    const row = res.body.data[0];
    // 70 + 40 + 10 days overdue plus half of the line due 5 days ago.
    expect(row.overdueAmount).toBe('340000');
    expect(row.overdueCount).toBe(4);
    expect(row.maxDaysOverdue).toBeGreaterThanOrEqual(70);
    expect(row.buckets.d60plus).toBe('100000');
    expect(row.buckets.d31_60).toBe('100000');
    expect(row.buckets.d0_30).toBe('140000');
    expect(row.counts).toEqual({ d0_30: 2, d31_60: 1, d60plus: 1 });
    expect(row.tenantPhone).toBe(phones.tenant);
  });

  it('the board is scoped to the caller portfolio and filters by bucket', async () => {
    const empty = await request(app.getHttpServer())
      .get('/api/v1/leases/arrears')
      .set('x-test-user', outsiderUserId)
      .expect(200);
    expect(empty.body.data).toEqual([]);

    const late = await request(app.getHttpServer())
      .get('/api/v1/leases/arrears?bucket=60%2B')
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(late.body.data).toHaveLength(1);
    expect(late.body.data[0].buckets.d60plus).toBe('100000');

    const recent = await request(app.getHttpServer())
      .get('/api/v1/leases/arrears?bucket=0-30')
      .set('x-test-user', ownerUserId)
      .expect(200);
    // No lease in this portfolio is stuck past 60 days on this filter alone.
    expect(recent.body.data[0].buckets.d0_30).toBe('140000');

    await request(app.getHttpServer())
      .get('/api/v1/leases/arrears?bucket=nope')
      .set('x-test-user', ownerUserId)
      .expect(400);
  });

  it('the summary adds the buckets up across the portfolio', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/leases/arrears/summary')
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(res.body.leaseCount).toBeGreaterThanOrEqual(1);
    expect(res.body.buckets.XAF.d0_30).toBe('140000');
    expect(res.body.buckets.XAF.d31_60).toBe('100000');
    expect(res.body.buckets.XAF.d60plus).toBe('100000');
    expect(res.body.totalOverdueByCurrency.XAF).toBe('340000');
  });

  it('the balance is readable by the tenant, not by a stranger', async () => {
    const leaseId = await leaseWithArrears();
    const tenant = await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/balance`)
      .set('x-test-user', tenantUserId)
      .expect(200);
    expect(tenant.body.overdueAmount).toBe('340000');
    expect(tenant.body.overdueCount).toBe(4);
    expect(tenant.body.nextDueDate).not.toBeNull();
    expect(tenant.body.depositHeld).toBe('0');
    expect(tenant.body.lines).toHaveLength(6);

    await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/balance`)
      .set('x-test-user', outsiderUserId)
      .expect(403);
  });

  it('the manager chases an overdue tenant, never an up-to-date one', async () => {
    const leaseId = await leaseWithArrears();

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/reminders`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(403);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/reminders`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    expect(res.body.sent).toBe(true);
    expect(res.body.amount).toBe('340000');
    expect(res.body.overdueCount).toBe(4);
    expect(res.body.message).toContain('en retard');

    const notifications = await prisma.notification.findMany({
      where: { userId: tenantUserId, type: 'RENT_REMINDER_MANUAL' },
      orderBy: { createdAt: 'desc' },
    });
    expect(notifications.length).toBeGreaterThan(0);
    const payload = notifications[0].payload as { amount?: string };
    expect(payload.amount).toBe('340000');

    // Settle everything: a reminder is then refused.
    await prisma.rentSchedule.updateMany({
      where: { leaseId, status: { not: 'PAID' } },
      data: { status: 'PAID', amountPaid: 100000 },
    });
    const clean = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/reminders`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(400);
    expect(clean.body.code).toBe('NO_OVERDUE_AMOUNT');
  });

  it('a custom reminder wording is carried through', async () => {
    const leaseId = await leaseWithArrears();
    const res = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/reminders`)
      .set('x-test-user', ownerUserId)
      .send({ channel: 'PUSH', message: 'Passez à l’agence avant vendredi.' })
      .expect(201);
    expect(res.body.channel).toBe('PUSH');
    expect(res.body.message).toBe('Passez à l’agence avant vendredi.');

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/reminders`)
      .set('x-test-user', ownerUserId)
      .send({ channel: 'SMS' })
      .expect(400);
  });
});
