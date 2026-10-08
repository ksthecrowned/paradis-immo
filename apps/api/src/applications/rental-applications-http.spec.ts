import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { ApplicationsModule } from './applications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Spec 04 P1 — HTTP surface of the candidature funnel.
 *
 * The routes the spec lists must actually resolve (global prefix
 * `api/v1`, `:id` params, role-independent seeker access) and the project-wide
 * `ValidationPipe` whitelist must reject unknown fields.
 */
describe('Rental applications HTTP (spec 04 P1)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let propertyId: string;
  let orgId: string;

  const phones = ['+242078880001', '+242078880002', '+242078880003'];
  let applicantIds: string[] = [];
  const orgName = `Spec04 App HTTP Org ${Date.now()}`;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PrismaModule, ApplicationsModule],
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

    // A crashed previous run may have left this suite's fixtures behind.
    const staleOrgs = await prisma.organization.findMany({
      where: { name: { startsWith: 'Spec04 App HTTP Org' } },
      select: { id: true },
    });
    const staleOrgIds = staleOrgs.map((o) => o.id);
    if (staleOrgIds.length) {
      const staleProps = await prisma.property.findMany({
        where: { organizationId: { in: staleOrgIds } },
        select: { id: true },
      });
      const stalePropIds = staleProps.map((p) => p.id);
      if (stalePropIds.length) {
        const staleLeases = await prisma.lease.findMany({
          where: { propertyId: { in: stalePropIds } },
          select: { id: true },
        });
        const staleLeaseIds = staleLeases.map((l) => l.id);
        if (staleLeaseIds.length) {
          const staleSchedules = await prisma.rentSchedule.findMany({
            where: { leaseId: { in: staleLeaseIds } },
            select: { id: true },
          });
          const staleScheduleIds = staleSchedules.map((s) => s.id);
          await prisma.rentReceipt.deleteMany({
            where: { rentScheduleId: { in: staleScheduleIds } },
          });
          await prisma.paymentAllocation.deleteMany({
            where: { rentScheduleId: { in: staleScheduleIds } },
          });
          await prisma.rentSchedule.deleteMany({
            where: { id: { in: staleScheduleIds } },
          });
          await prisma.lease.deleteMany({ where: { id: { in: staleLeaseIds } } });
        }
        const staleApps = await prisma.rentalApplication.findMany({
          where: { propertyId: { in: stalePropIds } },
          select: { id: true },
        });
        await prisma.solvencyCheck.deleteMany({
          where: { applicationId: { in: staleApps.map((a) => a.id) } },
        });
        await prisma.rentalApplication.deleteMany({
          where: { id: { in: staleApps.map((a) => a.id) } },
        });
        await prisma.property.deleteMany({ where: { id: { in: stalePropIds } } });
      }
      await prisma.documentSequence.deleteMany({
        where: { organizationId: { in: staleOrgIds } },
      });
      await prisma.organizationMember.deleteMany({
        where: { organizationId: { in: staleOrgIds } },
      });
      await prisma.organization.deleteMany({ where: { id: { in: staleOrgIds } } });
    }
    const staleUsers = await prisma.user.findMany({
      where: { phone: { in: [...phones, '+242078880000'] } },
      select: { id: true },
    });
    if (staleUsers.length) {
      const staleUserIds = staleUsers.map((u) => u.id);
      await prisma.notification.deleteMany({
        where: { userId: { in: staleUserIds } },
      });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleUserIds } } });
      await prisma.organizationMember.deleteMany({
        where: { userId: { in: staleUserIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: staleUserIds } } });
    }

    const owner = await prisma.user.create({
      data: {
        phone: phones[0],
        countryId,
        name: 'Spec04 App HTTP Owner',
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    applicantIds = [];
    for (const phone of phones.slice(1)) {
      const u = await prisma.user.create({
        data: {
          phone,
          countryId,
          name: `Spec04 Applicant ${phone.slice(-2)}`,
          roles: { create: { role: 'TENANT' } },
        },
      });
      applicantIds.push(u.id);
    }

    const org = await prisma.organization.create({
      data: {
        name: orgName,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    orgId = org.id;
    const prop = await prisma.property.create({
      data: {
        title: 'Spec04 App HTTP Property',
        description: 'Candidatures via HTTP',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 120000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Spec04 App HTTP',
        countryId,
        status: 'ACTIVE',
        ownerId: ownerUserId,
        organizationId: org.id,
      },
    });
    propertyId = prop.id;
  });

  afterAll(async () => {
    const leases = await prisma.lease.findMany({
      where: { propertyId },
      select: { id: true },
    });
    const leaseIds = leases.map((l) => l.id);
    if (leaseIds.length) {
      await prisma.rentSchedule.deleteMany({ where: { leaseId: { in: leaseIds } } });
      await prisma.lease.deleteMany({ where: { id: { in: leaseIds } } });
    }
    await prisma.solvencyCheck.deleteMany({
      where: { application: { propertyId } },
    });
    await prisma.rentalApplication.deleteMany({ where: { propertyId } });
    await prisma.documentSequence.deleteMany({
      where: { organizationId: orgId },
    });
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { userId: ownerUserId } });
    await prisma.organization.deleteMany({ where: { name: orgName } });
    const allUsers = [ownerUserId, ...applicantIds].filter(Boolean);
    await prisma.notification.deleteMany({ where: { userId: { in: allUsers } } });
    await prisma.userRole.deleteMany({ where: { userId: { in: allUsers } } });
    await prisma.user.deleteMany({ where: { id: { in: allUsers } } });
    await app.close();
    await prisma.onModuleDestroy();
  });

  beforeEach(async () => {
    await prisma.solvencyCheck.deleteMany({
      where: { application: { propertyId } },
    });
    await prisma.rentalApplication.deleteMany({ where: { propertyId } });
  });

  const applyPayload = (over: Record<string, unknown> = {}) => ({
    desiredMoveIn: new Date(Date.now() + 30 * 86_400_000)
      .toISOString()
      .slice(0, 10),
    occupants: 2,
    ...over,
  });

  it('POST /properties/:id/applications applies (201) and GET /applications/mine lists it', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .send(applyPayload({ occupation: 'Comptable' }))
      .expect(201);
    const applicationId = res.body.id as string;

    expect(res.body.status).toBe('SUBMITTED');
    expect(res.body.propertyId).toBe(propertyId);

    const mine = await request(app.getHttpServer())
      .get('/api/v1/applications/mine')
      .set('x-test-user', applicantIds[0])
      .expect(200);
    expect(mine.body).toHaveLength(1);
    expect(mine.body[0].id).toBe(applicationId);
    expect(mine.body[0].property.title).toBe('Spec04 App HTTP Property');
  });

  it('GET /properties/:id/applications returns { data, meta }', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .send(applyPayload())
      .expect(201);

    const res = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/applications?page=1&pageSize=5`)
      .set('x-test-user', ownerUserId)
      .expect(200);

    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta).toMatchObject({ total: 1, page: 1, pageSize: 5 });
    expect(res.body.data[0].applicant.phone).toBeTruthy();
  });

  it('a stranger cannot list the candidatures of a property (403)', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .expect(403);
  });

  it('the whitelist rejects an unknown field on apply (400)', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .send(applyPayload({ status: 'ACCEPTED' }))
      .expect(400);
  });

  it('PATCH /applications/:id accepts and auto-rejects the sibling', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .send(applyPayload())
      .expect(201);
    const second = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[1])
      .send(applyPayload())
      .expect(201);

    const accepted = await request(app.getHttpServer())
      .patch(`/api/v1/applications/${first.body.id}`)
      .set('x-test-user', ownerUserId)
      .send({ status: 'ACCEPTED' })
      .expect(200);
    expect(accepted.body.status).toBe('ACCEPTED');

    const loser = await prisma.rentalApplication.findUniqueOrThrow({
      where: { id: second.body.id },
    });
    expect(loser.status).toBe('REJECTED');
  });

  it('POST /applications/:id/solvency-checks creates a candidature-targeted check (201)', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .send(applyPayload())
      .expect(201);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${created.body.id}/solvency-checks`)
      .set('x-test-user', ownerUserId)
      .expect(201);

    expect(res.body.status).toBe('PENDING');
    expect(res.body.applicationId).toBe(created.body.id);
  });

  it('POST /applications/:id/lease returns a DRAFT lease and links it back', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .send(applyPayload())
      .expect(201);
    await request(app.getHttpServer())
      .patch(`/api/v1/applications/${created.body.id}`)
      .set('x-test-user', ownerUserId)
      .send({ status: 'ACCEPTED' })
      .expect(200);

    const res = await request(app.getHttpServer())
      .post(`/api/v1/applications/${created.body.id}/lease`)
      .set('x-test-user', ownerUserId)
      .send({})
      .expect(201);
    expect(res.body.status).toBe('DRAFT');
    expect(res.body.tenantId).toBe(applicantIds[0]);
    expect(Number(res.body.monthlyRent)).toBe(120000);

    const linked = await prisma.rentalApplication.findUniqueOrThrow({
      where: { id: created.body.id },
    });
    expect(linked.leaseId).toBe(res.body.id);
  });

  it('DELETE /applications/:id withdraws and a second withdrawal is a 409', async () => {
    const created = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .set('x-test-user', applicantIds[0])
      .send(applyPayload())
      .expect(201);

    const res = await request(app.getHttpServer())
      .delete(`/api/v1/applications/${created.body.id}`)
      .set('x-test-user', applicantIds[0])
      .expect(200);
    expect(res.body.status).toBe('WITHDRAWN');

    await request(app.getHttpServer())
      .delete(`/api/v1/applications/${created.body.id}`)
      .set('x-test-user', applicantIds[0])
      .expect(409);
  });

  it('every candidature route requires authentication (401)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/applications/mine')
      .expect(401);
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/applications`)
      .send(applyPayload())
      .expect(401);
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/applications`)
      .expect(401);
  });
});