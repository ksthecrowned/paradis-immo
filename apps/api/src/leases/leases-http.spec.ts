import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LeasesModule } from './leases.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { ListingsModule } from '../properties/listings.module';
import { PropertiesModule } from '../properties/properties.module';
import { PropertiesController } from '../properties/properties.controller';
import { LeasesController } from './leases.controller';

/**
 * Spec 04 P0 — HTTP surface of the lease lifecycle: `invitedPhone`, send for
 * signature, notice / withdrawal / closure, pagination and activation guards.
 */
describe('Leases HTTP — lifecycle (spec 04 P0)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let propertyId: string;
  const createdLeaseIds: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, LeasesModule, PropertiesModule],
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

    await prisma.user.deleteMany({ where: { phone: '+242070000021' } });
    const owner = await prisma.user.create({
      data: {
        phone: '+242070000021',
        countryId,
        name: 'Spec04 HTTP Owner',
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;
    const org = await prisma.organization.create({
      data: {
        name: `Spec04 HTTP Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const prop = await prisma.property.create({
      data: {
        title: 'Spec04 HTTP Property',
        description: 'Cycle de bail via HTTP',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 120000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Spec04 HTTP',
        countryId,
        status: 'ACTIVE',
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
      await prisma.notification.deleteMany({ where: { userId: ownerUserId } });
      await prisma.lease
        .deleteMany({ where: { id: { in: createdLeaseIds } } })
        .catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { userId: ownerUserId } });
    await prisma.organization.deleteMany({ where: { name: { startsWith: 'Spec04 HTTP Org' } } });
    await prisma.userRole.deleteMany({ where: { userId: ownerUserId } });
    await prisma.user.delete({ where: { id: ownerUserId } }).catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  const leasePayload = (over: Record<string, unknown> = {}) => ({
    propertyId,
    invitedPhone: '+242070009991',
    startDate: '2030-01-01',
    endDate: '2030-12-31',
    monthlyRent: 120000,
    deposit: 240000,
    currency: 'XAF',
    ...over,
  });

  it('POST /leases accepts invitedPhone and never creates the User', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(leasePayload())
      .expect(201);
    createdLeaseIds.push(res.body.id);

    expect(res.body.tenantId).toBeNull();
    expect(res.body.invitedPhone).toBe('+242070009991');
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.dueDay).toBe(5);
    expect(res.body.noticeMonthsTenant).toBe(3);
    expect(
      await prisma.user.count({ where: { phone: '+242070009991' } }),
    ).toBe(0);
  });

  it('POST /leases rejects an unknown field (whitelist) and an invalid phone', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(leasePayload({ nope: 1 }))
      .expect(400);
    await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(leasePayload({ invitedPhone: '00242' }))
      .expect(400);
  });

  it('POST /leases/:id/send-for-signature moves the lease to PENDING_SIGNATURE', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(leasePayload())
      .expect(201);
    createdLeaseIds.push(created.body.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/send-for-signature`)
      .set('x-test-user', ownerUserId)
      .expect(201);
    expect(res.body.status).toBe('PENDING_SIGNATURE');

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/send-for-signature`)
      .set('x-test-user', ownerUserId)
      .expect(400);
  });

  it('GET /leases/managed returns { data, meta } with page/pageSize', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/leases/managed?page=1&pageSize=2')
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(2);
    expect(typeof res.body.meta.total).toBe('number');
  });

  it('activating an overlapping lease answers 409 LEASE_OVERLAP over HTTP', async () => {
    const first = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(leasePayload())
      .expect(201);
    createdLeaseIds.push(first.body.id);
    await request(app.getHttpServer())
      .patch(`/api/v1/leases/${first.body.id}/activate`)
      .set('x-test-user', ownerUserId)
      .expect(200);

    const second = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(leasePayload({ startDate: '2030-06-01', endDate: '2031-05-31' }))
      .expect(201);
    createdLeaseIds.push(second.body.id);

    const res = await request(app.getHttpServer())
      .patch(`/api/v1/leases/${second.body.id}/activate`)
      .set('x-test-user', ownerUserId)
      .expect(409);
    expect(res.body.code).toBe('LEASE_OVERLAP');
  });

  it('notice, withdrawal and closure run over HTTP', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(
        leasePayload({
          invitedPhone: '+242070000021',
          startDate: '2031-01-01',
          endDate: '2031-12-31',
          noticeMonthsTenant: 0,
        }),
      )
      .expect(201);
    createdLeaseIds.push(created.body.id);
    await request(app.getHttpServer())
      .patch(`/api/v1/leases/${created.body.id}/activate`)
      .set('x-test-user', ownerUserId)
      .expect(200);

    const notice = await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/termination`)
      .set('x-test-user', ownerUserId)
      .send({
        initiator: 'TENANT',
        requestedEndDate: '2031-06-30',
      })
      .expect(201);
    expect(notice.body.status).toBe('TERMINATING');
    expect(notice.body.terminationEffectiveAt).not.toBeNull();

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/termination`)
      .set('x-test-user', ownerUserId)
      .send({ initiator: 'NOPE', requestedEndDate: '2031-06-30' })
      .expect(400);

    const withdrawn = await request(app.getHttpServer())
      .delete(`/api/v1/leases/${created.body.id}/termination`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(200);
    expect(withdrawn.body.status).toBe('ACTIVE');

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/termination`)
      .set('x-test-user', ownerUserId)
      .send({ initiator: 'TENANT', requestedEndDate: '2020-01-01' })
      .expect(201);
    const closed = await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/close`)
      .set('x-test-user', ownerUserId)
      .expect(201);
    expect(closed.body.status).toBe('TERMINATED');
    expect(closed.body.terminatedAt).not.toBeNull();
  });

  it('an occupied property leaves the public RENT_LONG list', async () => {
    const lease = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send(
        leasePayload({
          startDate: '2032-01-01',
          endDate: '2032-12-31',
          invitedPhone: '+242070000021',
        }),
      )
      .expect(201);
    createdLeaseIds.push(lease.body.id);
    await request(app.getHttpServer())
      .patch(`/api/v1/leases/${lease.body.id}/activate`)
      .set('x-test-user', ownerUserId)
      .expect(200);

    const listed = await request(app.getHttpServer())
      .get('/api/v1/properties?mode=RENT_LONG&limit=100')
      .expect(200);
    const ids = (listed.body.data ?? listed.body).map(
      (p: { id: string }) => p.id,
    );
    expect(ids).not.toContain(propertyId);

    await prisma.lease.update({
      where: { id: lease.body.id },
      data: { status: 'TERMINATED' },
    });
    await prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: 'AVAILABLE' },
    });
  });
});