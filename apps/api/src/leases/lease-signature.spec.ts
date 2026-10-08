import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LeaseStatus, ListingStatus } from '@prisma/client';
import { LeasesModule } from './leases.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';
import { PropertiesModule } from '../properties/properties.module';

/**
 * Spec 04 P1 — lease electronic signature (`POST /leases/:id/sign`).
 *
 * The tenant signs by OTP, then the bailleur side. The second signature
 * activates the lease (property `OCCUPIED`, rent schedule generated), and an
 * agent signing under a live mandate needs an approved `LEASE_SIGN` first.
 */
describe('Leases HTTP — OTP signature (spec 04 P1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let outsiderUserId: string;
  let agentUserId: string;
  let propertyId: string;
  let mandatedPropertyId: string;
  let agentOrgId: string;
  const phones = {
    owner: '+242070000041',
    tenant: '+242070000042',
    outsider: '+242070000043',
    agent: '+242070000044',
  };
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

    await prisma.user.deleteMany({ where: { phone: { in: Object.values(phones) } } });
    const mk = async (phone: string, name: string) =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role: 'TENANT' } } },
      });
    const owner = await mk(phones.owner, 'Spec04 Sign Owner');
    ownerUserId = owner.id;
    const tenant = await mk(phones.tenant, 'Spec04 Sign Tenant');
    tenantUserId = tenant.id;
    const outsider = await mk(phones.outsider, 'Spec04 Sign Outsider');
    outsiderUserId = outsider.id;
    const agent = await mk(phones.agent, 'Spec04 Sign Agent');
    agentUserId = agent.id;

    const ownerOrg = await prisma.organization.create({
      data: {
        name: `Spec04 Sign Owner Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    const agentOrg = await prisma.organization.create({
      data: {
        name: `Spec04 Sign Agency Org ${Date.now()}`,
        type: 'AGENCY',
        countryId,
        members: { create: { userId: agentUserId, role: 'ADMIN' } },
      },
    });
    agentOrgId = agentOrg.id;

    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec04 Sign Property',
          description: 'Signature OTP',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 120000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec04 Sign',
          countryId,
          ownerId: ownerUserId,
          organizationId: ownerOrg.id,
        },
      })
    ).id;
    mandatedPropertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec04 Sign Mandated Property',
          description: 'Signature OTP sous mandat',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 120000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec04 Sign mandat',
          countryId,
          ownerId: ownerUserId,
          organizationId: agentOrgId,
        },
      })
    ).id;
  });

  afterAll(async () => {
    if (createdLeaseIds.length) {
      await prisma.rentSchedule
        .deleteMany({ where: { leaseId: { in: createdLeaseIds } } })
        .catch(() => undefined);
    }
    await prisma.otpChallenge
      .deleteMany({ where: { phone: { in: Object.values(phones) } } })
      .catch(() => undefined);
    await prisma.notification.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, agentUserId] } },
    });
    await prisma.lease
      .deleteMany({ where: { id: { in: createdLeaseIds } } })
      .catch(() => undefined);
    await prisma.property
      .deleteMany({ where: { id: { in: [propertyId, mandatedPropertyId] } } })
      .catch(() => undefined);
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, outsiderUserId, agentUserId] } },
    });
    await prisma.organization.deleteMany({ where: { id: agentOrgId } }).catch(() => undefined);
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, tenantUserId, outsiderUserId, agentUserId] } },
    });
    await prisma.user
      .deleteMany({
        where: { id: { in: [ownerUserId, tenantUserId, outsiderUserId, agentUserId] } },
      })
      .catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  /** DRAFT → PENDING_SIGNATURE, owned by `ownerUserId`, tenant by phone. */
  async function pendingLease(
    overrides: Record<string, unknown> = {},
    userId: string = ownerUserId,
    propId: string = propertyId,
  ): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', userId)
      .send({
        propertyId: propId,
        invitedPhone: phones.tenant,
        startDate: '2033-01-01',
        endDate: '2033-12-31',
        monthlyRent: 120000,
        deposit: 240000,
        currency: 'XAF',
        ...overrides,
      })
      .expect(201);
    createdLeaseIds.push(created.body.id);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/send-for-signature`)
      .set('x-test-user', userId)
      .expect(201);
    return created.body.id;
  }

  async function currentCode(phone: string): Promise<string> {
    const row = await prisma.otpChallenge.findUnique({ where: { phone } });
    if (!row) throw new Error('No OTP challenge stored');
    return row.code;
  }

  it('refuses to sign a lease that is not PENDING_SIGNATURE', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('x-test-user', ownerUserId)
      .send({
        propertyId,
        invitedPhone: phones.tenant,
        startDate: '2034-01-01',
        endDate: '2034-12-31',
        monthlyRent: 120000,
        deposit: 240000,
        currency: 'XAF',
      })
      .expect(201);
    createdLeaseIds.push(created.body.id);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/leases/${created.body.id}/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: '123456' })
      .expect(400);
    expect(res.body.code).toBe('LEASE_NOT_SIGNABLE');
  });

  it('rejects an outsider and a malformed body', async () => {
    const leaseId = await pendingLease();
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', outsiderUserId)
      .send({})
      .expect(403);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: '12345' })
      .expect(400);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: '123456', nope: true })
      .expect(400);
  });

  it('tenant signs with an OTP: code is sent, a wrong code is refused, the right one signs', async () => {
    const leaseId = await pendingLease();

    const requested = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(201);
    expect(requested.body.signature).toMatchObject({
      sent: true,
      bothSigned: false,
      party: 'TENANT',
    });
    expect(requested.body.signature.signed).toBeUndefined();
    const stored = await prisma.otpChallenge.findUnique({
      where: { phone: phones.tenant },
    });
    expect(stored?.purpose).toBe('LEASE_SIGN');
    expect(stored?.code).toMatch(/^\d{6}$/);

    const wrong = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: '000000' })
      .expect(400);
    expect(wrong.body.code).toBe('SIGN_INVALID_CODE');
    expect(
      (await prisma.lease.findUnique({ where: { id: leaseId } }))?.tenantSignedAt,
    ).toBeNull();

    const signed = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: await currentCode(phones.tenant) })
      .expect(201);
    expect(signed.body.signature).toMatchObject({
      signed: true,
      bothSigned: false,
      party: 'TENANT',
    });
    expect(signed.body.tenantSignedAt).not.toBeNull();
    expect(signed.body.status).toBe('PENDING_SIGNATURE');
    // The code is single-use.
    expect(await prisma.otpChallenge.count({ where: { phone: phones.tenant } })).toBe(0);

    const twice = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(400);
    expect(twice.body.code).toBe('ALREADY_SIGNED');
  });

  it('the last signature activates the lease (OCCUPIED + rent schedule)', async () => {
    const leaseId = await pendingLease();
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: await currentCode(phones.tenant) })
      .expect(201);

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    const done = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', ownerUserId)
      .send({ otpCode: await currentCode(phones.owner) })
      .expect(201);

    expect(done.body.signature).toMatchObject({
      signed: true,
      bothSigned: true,
      party: 'LANDLORD',
    });
    expect(done.body.status).toBe('ACTIVE');
    expect(done.body.activatedAt).not.toBeNull();

    const lease = await prisma.lease.findUnique({ where: { id: leaseId } });
    expect(lease?.status).toBe(LeaseStatus.ACTIVE);
    expect(lease?.landlordSignedById).toBe(ownerUserId);

    const property = await prisma.property.findUnique({ where: { id: propertyId } });
    expect(property?.listingStatus).toBe(ListingStatus.OCCUPIED);
    expect(
      await prisma.rentSchedule.count({ where: { leaseId, status: 'PENDING' } }),
    ).toBeGreaterThan(0);

    // Reset the listing so later suites see an available property.
    await prisma.property.update({
      where: { id: propertyId },
      data: { listingStatus: ListingStatus.AVAILABLE },
    });
  });

  it('an agent needs an approved LEASE_SIGN to sign under an active mandate', async () => {
    const leaseId = await pendingLease({}, agentUserId, mandatedPropertyId);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({})
      .expect(201);
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', tenantUserId)
      .send({ otpCode: await currentCode(phones.tenant) })
      .expect(201);

    const mandate = await prisma.mandate.create({
      data: {
        propertyId: mandatedPropertyId,
        organizationId: agentOrgId,
        status: 'ACTIVE',
        proposedById: ownerUserId,
      },
    });

    const blocked = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', agentUserId)
      .send({})
      .expect(400);
    expect(blocked.body.code).toBe('LEASE_SIGN_APPROVAL_REQUIRED');

    const approval = await prisma.mandateApproval.create({
      data: {
        mandateId: mandate.id,
        actionType: 'LEASE_SIGN',
        payload: { leaseId },
        status: 'APPROVED',
        requestedById: agentUserId,
        decidedBy: ownerUserId,
        decidedAt: new Date(),
        expiresAt: new Date(Date.now() + 7 * 86_400_000),
      },
    });

    await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', agentUserId)
      .send({})
      .expect(201);
    const signed = await request(app.getHttpServer())
      .post(`/api/v1/leases/${leaseId}/sign`)
      .set('x-test-user', agentUserId)
      .send({ otpCode: await currentCode(phones.agent) })
      .expect(201);
    expect(signed.body.status).toBe('ACTIVE');
    expect(signed.body.signature.bothSigned).toBe(true);

    await prisma.mandateApproval.deleteMany({ where: { id: approval.id } });
    await prisma.mandate.deleteMany({ where: { id: mandate.id } });
    await prisma.property.update({
      where: { id: mandatedPropertyId },
      data: { listingStatus: ListingStatus.AVAILABLE },
    });
  });
});
