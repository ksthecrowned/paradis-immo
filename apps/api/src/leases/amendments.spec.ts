import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LeasesModule } from './leases.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Spec 04 P2 — avenants (US 7): versioned, signed by both parties, applied on
 * the double signature, with the future rent lines recomputed.
 */
describe('Leases HTTP — avenants (spec 04 P2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let outsiderUserId: string;
  let propertyId: string;
  const phones = {
    owner: '+242070000081',
    tenant: '+242070000082',
    outsider: '+242070000083',
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
    ownerUserId = (await mk(phones.owner, 'Spec04 Amend Owner')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec04 Amend Tenant')).id;
    outsiderUserId = (await mk(phones.outsider, 'Spec04 Amend Outsider')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec04 Amend Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec04 Amend Property',
          description: 'Avenants',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 100000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec04 Amend',
          countryId,
          ownerId: ownerUserId,
          organizationId: org.id,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (createdLeaseIds.length) {
      await prisma.leaseAmendment
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

  let leaseSlot = 0;

  /**
   * ACTIVE lease starting 3 months ago, so it has past and future lines.
   * Each call shifts the window forward so two leases never overlap.
   */
  async function activeLease(): Promise<string> {
    leaseSlot += 1;
    const start = new Date(Date.now() - 90 * DAY + leaseSlot * 400 * DAY);
    const end = new Date(start.getTime() + 365 * DAY);
    const created = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send({
        propertyId,
        invitedPhone: phones.tenant,
        startDate: start.toISOString().slice(0, 10),
        endDate: end.toISOString().slice(0, 10),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
        dueDay: 5,
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
    return leaseId;
  }

  async function currentCode(phone: string): Promise<string> {
    const row = await prisma.otpChallenge.findUnique({ where: { phone } });
    if (!row) throw new Error('No OTP challenge stored');
    return row.code;
  }

  it('an amendment is versioned, validated and notified to the tenant', async () => {
    const leaseId = await activeLease();
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', outsiderUserId)
      .send({ changes: { monthlyRent: 120000 } })
      .expect(403);

    const empty = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: {} })
      .expect(400);
    expect(empty.body.code).toBe('INVALID_AMENDMENT');

    const created = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { monthlyRent: 120000 }, reason: 'Indexation' })
      .expect(201);
    expect(created.body.version).toBe(1);
    expect(created.body.changes).toEqual({ monthlyRent: '120000' });
    expect(created.body.applied).toBe(false);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { chargesAmount: 10000 } })
      .expect(201);
    expect(second.body.version).toBe(2);

    const list = await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', tenantUserId)
      .expect(200);
    expect(list.body).toHaveLength(2);
    expect(list.body[0].version).toBe(2);

    const notified = await prisma.notification.findFirst({
      where: { userId: tenantUserId, type: 'AMENDMENT_PROPOSED' },
    });
    expect(notified).not.toBeNull();

    // The lease is untouched until both parties sign.
    const lease = await prisma.lease.findUniqueOrThrow({ where: { id: leaseId } });
    expect(lease.monthlyRent.toString()).toBe('100000');
  });

  it('refuses an amendment that does not change anything real', async () => {
    const leaseId = await activeLease();
    const bad = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({
        changes: { endDate: new Date(Date.now() - 10 * DAY).toISOString() },
      })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_AMENDMENT');

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { monthlyRent: 120000 }, nope: true })
      .expect(400);
  });

  it('both signatures apply the amendment and recompute the future lines', async () => {
    const leaseId = await activeLease();
    const created = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { monthlyRent: 120000 }, reason: 'IRL' })
      .expect(201);

    // A wrong code is refused and does not sign.
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: '000000' })
      .expect(400);

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(201);
    const tenantSigned = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: await currentCode(phones.tenant) })
      .expect(201);
    expect(tenantSigned.body.signature).toMatchObject({
      signed: true,
      bothSigned: false,
    });

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', outsiderUserId)
      .send({})
      .expect(403);

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    const applied = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', ownerUserId)
      .send({ otpCode: await currentCode(phones.owner) })
      .expect(201);
    expect(applied.body.signature).toMatchObject({
      bothSigned: true,
      applied: true,
    });
    expect(applied.body.applied).toBe(true);

    const lease = await prisma.lease.findUniqueOrThrow({ where: { id: leaseId } });
    expect(lease.monthlyRent.toString()).toBe('120000');

    // Rent lines due after the amendment carry the new amount.
    const lines = await prisma.rentSchedule.findMany({
      where: { leaseId, kind: 'RENT' },
      orderBy: { dueDate: 'asc' },
    });
    expect(lines.length).toBeGreaterThan(0);
    const effective = new Date(created.body.effectiveFrom);
    const before = lines.filter((l) => l.dueDate <= effective);
    const after = lines.filter((l) => l.dueDate > effective);
    expect(before.every((l) => l.rentPart.toString() === '100000')).toBe(true);
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((l) => l.rentPart.toString() === '120000')).toBe(true);

    const notified = await prisma.notification.findFirst({
      where: { userId: tenantUserId, type: 'AMENDMENT_APPLIED' },
    });
    expect(notified).not.toBeNull();

    const again = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(409);
    expect(again.body.code).toBe('AMENDMENT_ALREADY_SIGNED');
    expect(created.body.version).toBe(1);
  });

  it('an amendment never touches an already-paid or partial month', async () => {
    const leaseId = await activeLease();
    // A month that already carries money must survive the recomputation.
    const partial = await prisma.rentSchedule.findFirstOrThrow({
      where: { leaseId, kind: 'RENT' },
      orderBy: { dueDate: 'asc' },
    });
    await prisma.rentSchedule.update({
      where: { id: partial.id },
      data: { status: 'PARTIAL', amountPaid: 40000 },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { monthlyRent: 130000 } })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: await currentCode(phones.tenant) })
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/amendments/1/sign`)
      .set('x-test-user', ownerUserId)
      .send({ otpCode: await currentCode(phones.owner) })
      .expect(201);

    const kept = await prisma.rentSchedule.findUniqueOrThrow({
      where: { id: partial.id },
    });
    expect(kept.status).toBe('PARTIAL');
    expect(kept.amountPaid.toString()).toBe('40000');

    const duplicates = await prisma.rentSchedule.findMany({
      where: { leaseId, kind: 'RENT', dueDate: partial.dueDate },
    });
    expect(duplicates).toHaveLength(1);
  });
});
