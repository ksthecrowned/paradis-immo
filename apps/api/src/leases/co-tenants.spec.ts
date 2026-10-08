import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { LeasesModule } from './leases.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Spec 04 P2 — colocation (US 7) : un avenant fait entrer ou sortir un
 * colocataire (`changes.coTenants`). Chaque ajout exige un compte existant
 * (pas de création silencieuse d'user), les deux parties signent, puis le
 * colocataire est visible via `GET /leases/:id/co-tenants`.
 */
describe('Leases HTTP — colocation (spec 04 P2)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let countryId: string;
  let bzvQuartierId: string;
  let ownerUserId: string;
  let tenantUserId: string;
  let colocUserId: string;
  let outsiderUserId: string;
  let propertyId: string;
  let colocLeaseId: string;
  const phones = {
    owner: '+242070000131',
    tenant: '+242070000132',
    coloc: '+242070000133',
    outsider: '+242070000134',
    unknown: '+242070000199',
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

    // Purge leftovers of a previous failed run (unique (phone, countryId)).
    const stale = await prisma.user.findMany({
      where: { phone: { in: [...Object.values(phones), phones.unknown] } },
      select: { id: true },
    });
    const staleIds = stale.map((u) => u.id);
    if (staleIds.length) {
      await prisma.notification.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.organizationMember.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.userRole.deleteMany({ where: { userId: { in: staleIds } } });
      await prisma.user.deleteMany({ where: { id: { in: staleIds } } });
    }

    const mk = async (phone: string, name: string) =>
      prisma.user.create({
        data: { phone, countryId, name, roles: { create: { role: 'TENANT' } } },
      });
    ownerUserId = (await mk(phones.owner, 'Spec04 Coloc Owner')).id;
    tenantUserId = (await mk(phones.tenant, 'Spec04 Coloc Tenant')).id;
    colocUserId = (await mk(phones.coloc, 'Spec04 Coloc Roommate')).id;
    outsiderUserId = (await mk(phones.outsider, 'Spec04 Coloc Outsider')).id;

    const org = await prisma.organization.create({
      data: {
        name: `Spec04 Coloc Org ${Date.now()}`,
        type: 'OWNER',
        countryId,
        members: { create: { userId: ownerUserId, role: 'OWNER' } },
      },
    });
    propertyId = (
      await prisma.property.create({
        data: {
          title: 'Spec04 Coloc Property',
          description: 'Colocation',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          price: 100000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: bzvQuartierId,
          address: 'Spec04 Coloc',
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
      await prisma.leaseTenant
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
    const ids = [ownerUserId, tenantUserId, colocUserId, outsiderUserId];
    await prisma.notification.deleteMany({ where: { userId: { in: ids } } });
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.organizationMember.deleteMany({ where: { userId: { in: ids } } });
    await prisma.organization
      .deleteMany({ where: { members: { some: { userId: ownerUserId } } } })
      .catch(() => undefined);
    await prisma.userRole.deleteMany({ where: { userId: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } }).catch(() => undefined);
    await app.close();
    await prisma.onModuleDestroy();
  });

  let slot = 0;

  /** ACTIVE lease, each call shifts the window so leases never overlap. */
  async function activeLease(): Promise<string> {
    slot += 1;
    const start = new Date(Date.now() - 60 * DAY + slot * 400 * DAY);
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

  /** Tenant then landlord, OTP each side (both signatures = applied). */
  async function signAmendmentFully(leaseId: string, version: number): Promise<void> {
    const parties = [
      { phone: phones.tenant, userId: tenantUserId },
      { phone: phones.owner, userId: ownerUserId },
    ];
    for (const party of parties) {
      await request(app.getHttpServer())
        .post(`/api/v1/leases/${leaseId}/amendments/${version}/sign`)
        .set('x-test-user', party.userId)
        .send({})
        .expect(201);
      await request(app.getHttpServer())
        .post(`/api/v1/leases/${leaseId}/amendments/${version}/sign`)
        .set('x-test-user', party.userId)
        .send({ otpCode: await currentCode(party.phone) })
        .expect(201);
    }
  }

  it('an amendment seats a co-tenant once both parties signed', async () => {
    colocLeaseId = await activeLease();

    const empty = await request(app.getHttpServer())
      .get(`/api/v1/leases/${colocLeaseId}/co-tenants`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(empty.body).toEqual([]);

    const created = await request(app.getHttpServer())
      .post(`/api/v1/leases/${colocLeaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({
        changes: { coTenants: { add: [phones.coloc] } },
        reason: 'Colocation',
      })
      .expect(201);
    expect(created.body.version).toBe(1);
    expect(created.body.changes.coTenants).toEqual({ add: [phones.coloc] });

    // Not seated before both signatures.
    const beforeSign = await prisma.leaseTenant.findUnique({
      where: {
        leaseId_userId: { leaseId: colocLeaseId, userId: colocUserId },
      },
    });
    expect(beforeSign).toBeNull();

    await signAmendmentFully(colocLeaseId, 1);

    const seated = await prisma.leaseTenant.findUniqueOrThrow({
      where: { leaseId_userId: { leaseId: colocLeaseId, userId: colocUserId } },
    });
    expect(seated.isPrimary).toBe(false);

    const notified = await prisma.notification.findFirst({
      where: { userId: colocUserId, type: 'CO_TENANT_ADDED' },
    });
    expect(notified).not.toBeNull();

    const list = await request(app.getHttpServer())
      .get(`/api/v1/leases/${colocLeaseId}/co-tenants`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(list.body).toHaveLength(1);
    expect(list.body[0]).toMatchObject({
      userId: colocUserId,
      name: 'Spec04 Coloc Roommate',
      phone: phones.coloc,
      isPrimary: false,
    });
  });

  it('refuses an unknown phone (no silent User creation)', async () => {
    const bad = await request(app.getHttpServer())
      .post(`/api/v1/leases/${colocLeaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { coTenants: { add: [phones.unknown] } } })
      .expect(400);
    expect(bad.body.code).toBe('CO_TENANT_NOT_FOUND');
    const ghost = await prisma.user.findFirst({ where: { phone: phones.unknown } });
    expect(ghost).toBeNull();
  });

  it('refuses an empty coTenants change', async () => {
    const bad = await request(app.getHttpServer())
      .post(`/api/v1/leases/${colocLeaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { coTenants: {} } })
      .expect(400);
    expect(bad.body.code).toBe('INVALID_AMENDMENT');
  });

  it('an amendment removes a seated co-tenant', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${colocLeaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { coTenants: { remove: [colocUserId] } } })
      .expect(201);

    await signAmendmentFully(colocLeaseId, 2);

    const gone = await prisma.leaseTenant.findUnique({
      where: { leaseId_userId: { leaseId: colocLeaseId, userId: colocUserId } },
    });
    expect(gone).toBeNull();

    const list = await request(app.getHttpServer())
      .get(`/api/v1/leases/${colocLeaseId}/co-tenants`)
      .set('x-test-user', ownerUserId)
      .expect(200);
    expect(list.body).toEqual([]);
  });

  it('the tenant and the co-tenant can read the list, an outsider cannot', async () => {
    // Re-seat the co-tenant for this access check.
    await request(app.getHttpServer())
      .post(`/api/v1/leases/${colocLeaseId}/amendments`)
      .set('x-test-user', ownerUserId)
      .send({ changes: { coTenants: { add: [phones.coloc] } } })
      .expect(201);
    await signAmendmentFully(colocLeaseId, 3);

    await request(app.getHttpServer())
      .get(`/api/v1/leases/${colocLeaseId}/co-tenants`)
      .set('x-test-user', tenantUserId)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/leases/${colocLeaseId}/co-tenants`)
      .set('x-test-user', colocUserId)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/api/v1/leases/${colocLeaseId}/co-tenants`)
      .set('x-test-user', outsiderUserId)
      .expect(403);
  });
});
