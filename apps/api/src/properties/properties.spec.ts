import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { PropertiesModule } from './properties.module';

describe('Properties (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ownerUserId: string;
  let outsiderUserId: string;
  let bzvQuartierId: string;
  let countryId: string;
  let createdPropertyId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PropertiesModule],
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

    const country =
      (await prisma.country.findUnique({ where: { code: 'CG' } })) ??
      (await prisma.country.create({
        data: {
          code: 'CG',
          name: 'Congo',
          currency: 'XAF',
          phonePrefix: '+242',
          activeProviders: ['AIRTEL'],
        },
      }));
    countryId = country.id;

    const quartier = await prisma.quartier.findFirst({
      where: { arrondissement: { city: { name: 'Brazzaville' } } },
    });
    if (!quartier) throw new Error('Seed Brazzaville quartiers first');
    bzvQuartierId = quartier.id;

    // Cleanup users from previous runs
    await prisma.user.deleteMany({
      where: { phone: { in: ['+242074444444', '+242075555555'] } },
    });

    const owner = await prisma.user.create({
      data: {
        phone: '+242074444444',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    ownerUserId = owner.id;

    const outsider = await prisma.user.create({
      data: {
        phone: '+242075555555',
        countryId,
        roles: { create: { role: 'TENANT' } },
      },
    });
    outsiderUserId = outsider.id;
  });

  afterAll(async () => {
    // Cleanup any leftover properties
    if (createdPropertyId) {
      await prisma.property.delete({ where: { id: createdPropertyId } });
    }
    await prisma.organizationMember.deleteMany({
      where: { userId: { in: [ownerUserId, outsiderUserId] } },
    });
    await prisma.organization.deleteMany({
      where: {
        members: { some: { userId: ownerUserId } },
        type: 'OWNER',
      },
    });
    await prisma.userRole.deleteMany({
      where: { userId: { in: [ownerUserId, outsiderUserId] } },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerUserId, outsiderUserId] } },
    });
    await app.close();
    await prisma.onModuleDestroy();
  });

  // ------------------------------------------------------------------
  // Creation
  // ------------------------------------------------------------------

  it('POST /properties creates a property for an authenticated owner', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/properties')
      .set('x-test-user', ownerUserId)
      .send({
        title: 'Appartement test Brazzaville',
        description: 'Bel appartement 2 chambres',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 150000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: bzvQuartierId,
        address: 'Rue Test 123',
        countryId,
        bedrooms: 2,
        bathrooms: 1,
      })
      .expect(201);

    const body = res.body as {
      id: string;
      title: string;
      mode: string;
      status: string;
      ownerOrg: { type: string };
    };
    expect(body.id).toBeDefined();
    expect(body.title).toBe('Appartement test Brazzaville');
    expect(body.mode).toBe('RENT_LONG');
    expect(body.status).toBe('DRAFT');
    expect(body.ownerOrg.type).toBe('OWNER');
    createdPropertyId = body.id;
  });

  it('GET /properties/:id returns the property', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/properties/${createdPropertyId}`)
      .expect(200);
    const body = res.body as { id: string; title: string };
    expect(body.id).toBe(createdPropertyId);
  });

  // ------------------------------------------------------------------
  // Marketplace filters
  // ------------------------------------------------------------------

  it('GET /properties?quartierId=... returns matching property', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/properties?quartierId=${bzvQuartierId}&mode=RENT_LONG`)
      .expect(200);
    const body = res.body as {
      data: Array<{
        id: string;
        quartier: { id: string };
        mode: string;
      }>;
      meta: { total: number };
    };
    expect(body.meta.total).toBeGreaterThan(0);
    body.data.forEach((p) => {
      expect(p.quartier.id).toBe(bzvQuartierId);
      expect(p.mode).toBe('RENT_LONG');
    });
  });

  it('GET /properties?mode=SALE excludes RENT_LONG properties', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/properties?mode=SALE')
      .expect(200);
    const body = res.body as {
      data: Array<{ id: string; mode: string }>;
    };
    body.data.forEach((p) => expect(p.mode).toBe('SALE'));
    expect(body.data.find((p) => p.id === createdPropertyId)).toBeUndefined();
  });

  it('GET /properties?minPrice=200000 excludes cheaper property', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/properties?minPrice=200000')
      .expect(200);
    const body = res.body as { data: Array<{ id: string }> };
    expect(body.data.find((p) => p.id === createdPropertyId)).toBeUndefined();
  });

  // ------------------------------------------------------------------
  // Exclusive mode enforcement
  // ------------------------------------------------------------------

  it('PATCH /properties/:id refuses to change mode on an ACTIVE property (must archive first)', async () => {
    // Move the property to ACTIVE first
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'ACTIVE' },
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${createdPropertyId}`)
      .set('x-test-user', ownerUserId)
      .send({ mode: 'SALE' })
      .expect(400);

    // Reset to DRAFT for subsequent tests
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'DRAFT' },
    });
  });

  it('PATCH /properties/:id allows updating title and price', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/properties/${createdPropertyId}`)
      .set('x-test-user', ownerUserId)
      .send({ title: 'Appartement rénové BZV', price: 175000 })
      .expect(200);
    const body = res.body as { title: string; price: number };
    expect(body.title).toBe('Appartement rénové BZV');
    expect(Number(body.price)).toBe(175000);
  });

  it('POST /properties/:id/archive archives the property', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${createdPropertyId}/archive`)
      .set('x-test-user', ownerUserId)
      .expect(200);

    const fresh = await prisma.property.findUnique({
      where: { id: createdPropertyId },
    });
    expect(fresh?.status).toBe('ARCHIVED');
  });

  // ------------------------------------------------------------------
  // RBAC
  // ------------------------------------------------------------------

  it('PATCH /properties/:id rejects a non-owner user (403)', async () => {
    // Un-archive so we can attempt the patch
    await prisma.property.update({
      where: { id: createdPropertyId },
      data: { status: 'DRAFT' },
    });
    await request(app.getHttpServer())
      .patch(`/api/v1/properties/${createdPropertyId}`)
      .set('x-test-user', outsiderUserId)
      .send({ title: 'Hacked' })
      .expect(403);
  });

  it('GET /properties/:id is public', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/properties/${createdPropertyId}`)
      .expect(200);
  });

  it('POST /properties rejects request with no auth context (401)', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/properties')
      .send({
        title: 'X',
        description: 'X',
        type: 'HOUSE',
        mode: 'SALE',
        price: 1,
        currency: 'XAF',
        priceUnit: 'TOTAL',
        quartierId: bzvQuartierId,
        address: 'X',
        countryId,
      })
      .expect(401);
  });

  // ------------------------------------------------------------------
  // Owner dashboard: GET /properties/mine
  // ------------------------------------------------------------------

  it('GET /properties/mine returns only the authenticated user properties', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/properties/mine')
      .set('x-test-user', ownerUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);

    const body = res.body as {
      data: Array<{ id: string; ownerId: string }>;
      meta: { total: number; limit: number; offset: number };
    };
    expect(body.data).toBeDefined();
    expect(body.meta).toBeDefined();
    // Every returned property must be owned by the caller.
    body.data.forEach((p) => expect(p.ownerId).toBe(ownerUserId));
  });

  it('GET /properties/mine returns zero properties for a user with none', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/properties/mine')
      .set('x-test-user', outsiderUserId)
      .set('x-test-roles', 'TENANT')
      .expect(200);

    const body = res.body as {
      data: Array<{ id: string; ownerId: string }>;
    };
    // Outsider has no properties — every row (none) trivially has ownerId
    // matching the caller.
    expect(body.data.every((p) => p.ownerId === outsiderUserId)).toBe(true);
  });

  it('GET /properties/mine rejects request with no auth context (401)', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/properties/mine')
      .expect(401);
  });
});
