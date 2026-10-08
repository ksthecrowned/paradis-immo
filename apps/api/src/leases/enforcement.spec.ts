import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LeasesModule } from './leases.module';
import { EnforcementService } from './enforcement.service';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Spec 04 P2 — recouvrement.
 *
 * Late fees are applied once per rent line past `lateFeeAfterDays` (flat or
 * percentage), the manager can waive one, and the formal notice PDF is only
 * allowed once the arrears are 15 days old — and only once per episode.
 */
describe('Leases HTTP — pénalités et mise en demeure (spec 04 P2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let enforcement: EnforcementService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let outsiderUserId: string;
  let propertyId: string;
  const phones = {
    owner: '+242070000071',
    tenant: '+242070000072',
    outsider: '+242070000073',
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
    enforcement = moduleRef.get(EnforcementService);
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
    ownerUserId = (await mk(phones.owner, 'Spec04 Fee Owner')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec04 Fee Tenant')).id;
    outsiderUserId = (await mk(phones.outsider, 'Spec04 Fee Outsider')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec04 Fee Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec04 Fee Property',
          description: 'Pénalités',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 100000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec04 Fee',
          countryId,
          ownerId: ownerUserId,
          organizationId: org.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (createdLeaseIds.length) {
      await prisma.leaseDocument
        .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
        .catch(() => undefined);
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

  let leaseYear = 2045;

  /**
   * ACTIVE lease with a single rent line overdue by `daysOverdue` days and the
   * requested penalty terms (flat amount XOR rate).
   */
  async function leaseWithLateRent(
    daysOverdue: number,
    terms: {
      lateFeeAfterDays?: number;
      lateFeeAmount?: number;
      lateFeeRate?: number;
    } = {},
  ): Promise<string> {
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
        ...terms,
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
    await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date(now - daysOverdue * DAY),
        kind: 'RENT',
        amount: 100000,
        currency: 'XAF',
        status: 'OVERDUE',
      },
    });
    // Deposit line kept so the waiver test can prove DEPOSIT is never penalised.
    await prisma.rentSchedule.create({
      data: {
        leaseId,
        dueDate: new Date(now - daysOverdue * DAY),
        kind: 'DEPOSIT',
        amount: 200000,
        currency: 'XAF',
        status: 'OVERDUE',
      },
    });
    return leaseId;
  }

  it('applies one flat late fee per late rent line, never on the deposit', async () => {
    const leaseId = await leaseWithLateRent(20, {
      lateFeeAfterDays: 5,
      lateFeeAmount: 15000,
    });

    const first = await enforcement.applyLateFees(new Date());
    const fees = await prisma.rentSchedule.findMany({
      where: { leaseId, kind: 'LATE_FEE' },
    });
    expect(fees).toHaveLength(1);
    expect(fees[0].amount.toString()).toBe('15000');
    expect(fees[0].status).toBe('PENDING');
    expect(first.applied.length).toBeGreaterThanOrEqual(1);

    // Idempotent: a second pass never doubles the fee.
    await enforcement.applyLateFees(new Date());
    expect(
      await prisma.rentSchedule.count({ where: { leaseId, kind: 'LATE_FEE' } }),
    ).toBe(1);
  });

  it('computes a percentage late fee from the monthly rent', async () => {
    const leaseId = await leaseWithLateRent(20, {
      lateFeeAfterDays: 5,
      lateFeeRate: 0.05,
    });
    await enforcement.applyLateFees(new Date());
    const fees = await prisma.rentSchedule.findMany({
      where: { leaseId, kind: 'LATE_FEE' },
    });
    expect(fees).toHaveLength(1);
    expect(fees[0].amount.toString()).toBe('5000');
  });

  it('applies nothing before lateFeeAfterDays', async () => {
    const leaseId = await leaseWithLateRent(3, {
      lateFeeAfterDays: 10,
      lateFeeAmount: 15000,
    });
    await enforcement.applyLateFees(new Date());
    expect(
      await prisma.rentSchedule.count({ where: { leaseId, kind: 'LATE_FEE' } }),
    ).toBe(0);
  });

  it('the manager waives a late fee, and only once', async () => {
    const leaseId = await leaseWithLateRent(20, {
      lateFeeAfterDays: 5,
      lateFeeAmount: 15000,
    });
    await enforcement.applyLateFees(new Date());
    const fee = await prisma.rentSchedule.findFirstOrThrow({
      where: { leaseId, kind: 'LATE_FEE' },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/rent-schedules/${fee.id}/waive-fee`)
      .set('x-test-user', outsiderUserId)
      .send({})
      .expect(403);

    const waived = await request(app.getHttpServer())
      .post(`/api/v1/rent-schedules/${fee.id}/waive-fee`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    expect(waived.body.waived).toBe(true);
    const line = await prisma.rentSchedule.findUniqueOrThrow({
      where: { id: fee.id },
    });
    expect(line.status).toBe('CANCELLED');

    const again = await request(app.getHttpServer())
      .post(`/api/v1/rent-schedules/${fee.id}/waive-fee`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(409);
    expect(again.body.code).toBe('LATE_FEE_ALREADY_WAIVED');

    // A rent line is not a late fee.
    const rent = await prisma.rentSchedule.findFirstOrThrow({
      where: { leaseId, kind: 'RENT' },
    });
    const wrong = await request(app.getHttpServer())
      .post(`/api/v1/rent-schedules/${rent.id}/waive-fee`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(400);
    expect(wrong.body.code).toBe('NOT_A_LATE_FEE');
  });

  it('the formal notice waits for 15 days of arrears', async () => {
    const leaseId = await leaseWithLateRent(10, {
      lateFeeAfterDays: 5,
      lateFeeAmount: 15000,
    });
    const tooEarly = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/formal-notice`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(400);
    expect(tooEarly.body.code).toBe('FORMAL_NOTICE_NOT_DUE');
    // The letter reports the age of the oldest arrears.
    expect(tooEarly.body.message).toContain('10 j');
  });

  it('issues the formal notice PDF once per arrears episode', async () => {
    const leaseId = await leaseWithLateRent(40, {
      lateFeeAfterDays: 5,
      lateFeeAmount: 15000,
    });
    await enforcement.applyLateFees(new Date());

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/formal-notice`)
      .set('x-test-user', outsiderUserId)
      .send({})
      .expect(403);

    const notice = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/formal-notice`)
      .set('x-test-user', ownerUserId)
      .send({ paymentDelayDays: 10 })
      .expect(201);
    // The notice lists what is actually late: the rent line. The penalty is
    // due today, not overdue, so it stays out of the letter.
    expect(notice.body.totalDue).toBe('100000');
    expect(notice.body.overdueCount).toBe(1);
    expect(notice.body.paymentDelayDays).toBe(10);
    expect(notice.body.url).toContain('https://');

    const stored = await prisma.leaseDocument.findUniqueOrThrow({
      where: { id: notice.body.id },
    });
    expect(stored.type).toBe('FORMAL_NOTICE');
    expect(stored.uploadedBy).toBe(ownerUserId);

    const tenantNotified = await prisma.notification.findFirst({
      where: { userId: tenantUserId, type: 'FORMAL_NOTICE_SENT' },
    });
    const ownerNotified = await prisma.notification.findFirst({
      where: { userId: ownerUserId, type: 'FORMAL_NOTICE_SENT' },
    });
    expect(tenantNotified).not.toBeNull();
    expect(ownerNotified).not.toBeNull();

    const duplicate = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/formal-notice`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(409);
    expect(duplicate.body.code).toBe('FORMAL_NOTICE_ALREADY_SENT');

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/formal-notice`)
      .set('x-test-user', ownerUserId)
      .send({ paymentDelayDays: 400 })
      .expect(400);
  });

  it('refuses a formal notice when nothing is overdue', async () => {
    const leaseId = await leaseWithLateRent(40);
    await prisma.rentSchedule.updateMany({
      where: { leaseId },
      data: { status: 'PAID', amountPaid: 100000 },
    });
    const res = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/formal-notice`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(400);
    expect(res.body.code).toBe('NO_OVERDUE_AMOUNT');
  });
});
