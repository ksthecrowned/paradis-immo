import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../prisma/prisma.service';
import { EventPublisher } from '../events/event.publisher';
import { PropertiesModule } from './properties.module';

describe('Property views (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const ownerId = 'user_views_owner';
  const memberId = 'user_views_member';
  const visitorId = 'user_views_visitor';
  const propertyId = 'prop_views_test';
  const draftPropertyId = 'prop_views_draft';
  let organizationId: string;

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

    const cg = await prisma.country.findFirstOrThrow();
    const quartier = await prisma.quartier.findFirstOrThrow({
      include: { arrondissement: { include: { city: true } } },
    });

    for (const [id, phone] of [
      [ownerId, '+242060000201'],
      [memberId, '+242060000202'],
      [visitorId, '+242060000203'],
    ] as const) {
      await prisma.user.upsert({
        where: { id },
        create: { id, phone, countryId: cg.id },
        update: {},
      });
    }

    const org = await prisma.organization.findFirstOrThrow({
      where: { countryId: cg.id },
    });
    organizationId = org.id;
    await prisma.organizationMember.upsert({
      where: {
        userId_organizationId: { userId: memberId, organizationId },
      },
      create: { userId: memberId, organizationId, role: 'AGENT' },
      update: {},
    });

    for (const [id, status] of [
      [propertyId, 'ACTIVE'],
      [draftPropertyId, 'DRAFT'],
    ] as const) {
      await prisma.property.upsert({
        where: { id },
        create: {
          id,
          ownerId,
          organizationId,
          title: `Views test property ${status}`,
          description: 'x',
          type: 'APARTMENT',
          mode: 'RENT_LONG',
          status,
          price: 100000,
          currency: 'XAF',
          priceUnit: 'MONTH',
          quartierId: quartier.id,
          address: 'test',
          countryId: cg.id,
        },
        update: { status },
      });
    }

    await prisma.propertyView.deleteMany({
      where: { propertyId: { in: [propertyId, draftPropertyId] } },
    });
  });

  afterAll(async () => {
    await prisma.propertyView.deleteMany({
      where: { propertyId: { in: [propertyId, draftPropertyId] } },
    });
    await prisma.property.deleteMany({
      where: { id: { in: [propertyId, draftPropertyId] } },
    });
    await prisma.organizationMember.deleteMany({
      where: { userId: memberId, organizationId },
    });
    await prisma.user.deleteMany({
      where: { id: { in: [ownerId, memberId, visitorId] } },
    });
    await app.close();
    await prisma.onModuleDestroy();
  });

  it('counts an anonymous device view once per day', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/views`)
      .send({ deviceId: 'device-abc' })
      .expect(201);
    expect(first.body.counted).toBe(true);

    const second = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/views`)
      .send({ deviceId: 'device-abc' })
      .expect(201);
    expect(second.body.counted).toBe(false);
  });

  it('prefers the authenticated user identity over deviceId', async () => {
    const first = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/views`)
      .set('x-test-user', visitorId)
      .send({ deviceId: 'device-xyz' })
      .expect(201);
    expect(first.body.counted).toBe(true);

    // Same user with another device: still deduplicated on the account.
    const second = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/views`)
      .set('x-test-user', visitorId)
      .send({ deviceId: 'device-other' })
      .expect(201);
    expect(second.body.counted).toBe(false);
  });

  it('does not count views from the owner or org members', async () => {
    const asOwner = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/views`)
      .set('x-test-user', ownerId)
      .send({})
      .expect(201);
    expect(asOwner.body.counted).toBe(false);

    const asMember = await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/views`)
      .set('x-test-user', memberId)
      .send({})
      .expect(201);
    expect(asMember.body.counted).toBe(false);
  });

  it('does not count views on non-ACTIVE properties', async () => {
    const res = await request(app.getHttpServer())
      .post(`/api/v1/properties/${draftPropertyId}/views`)
      .send({ deviceId: 'device-abc' })
      .expect(201);
    expect(res.body.counted).toBe(false);
  });

  it('rejects anonymous requests without a deviceId', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/properties/${propertyId}/views`)
      .send({})
      .expect(400);
  });

  it('returns 404 for an unknown property', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/properties/00000000-0000-0000-0000-000000000000/views')
      .send({ deviceId: 'device-abc' })
      .expect(404);
  });

  it('exposes viewCount on the public property payload', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}`)
      .expect(200);
    // device-abc + visitor account = 2 unique views recorded above
    expect(res.body.viewCount).toBe(2);
  });
});
