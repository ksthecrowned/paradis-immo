import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { EventPublisher } from '../src/events/event.publisher';
import { PrismaService } from '../src/prisma/prisma.service';
import { SEED_IDS } from '../../src/common/constants/seed-ids';

describe('Leases flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const ownerPhone = '+242068888883';
  const tenantPhone = '+242068888884';
  let ownerToken: string;
  let propertyId: string;
  let tenantUserId: string;
  let leaseId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EventPublisher)
      .useValue({ emit: jest.fn() })
      .compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);

    // Login as owner
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: ownerPhone })
      .expect(202);
    const code = await otpStore.peek(ownerPhone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: ownerPhone, code: code! })
      .expect(200);
    ownerToken = login.body.accessToken;
    const ownerId = login.body.user.id;

    // Find an existing property (from seed) or create one
    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'E2E Lease Test Property',
        description: 'A property for lease e2e tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Test address',
        countryId: cg.id,
        ownerId,
        organizationId: SEED_IDS.orgParadisImmo,
      },
    });
    propertyId = property.id;

    // Create tenant
    const tenant = await prisma.user.create({
      data: {
        phone: tenantPhone,
        countryId: cg.id,
        roles: { create: { role: 'TENANT' } },
      },
    });
    tenantUserId = tenant.id;
  });

  afterAll(async () => {
    if (leaseId) {
      await prisma.rentSchedule.deleteMany({ where: { leaseId } });
      await prisma.lease.delete({ where: { id: leaseId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await prisma.user.delete({ where: { id: tenantUserId } }).catch(() => undefined);
    await app.close();
  });

  it('POST /leases creates a DRAFT lease', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/leases')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({
        propertyId,
        tenantId: tenantUserId,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
        monthlyRent: 100000,
        deposit: 200000,
        currency: 'XAF',
      })
      .expect(201);
    expect(res.body.status).toBe('DRAFT');
    leaseId = res.body.id;
  });

  it('PATCH /leases/:id/activate generates a rent schedule', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/leases/${leaseId}/activate`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(res.body.status).toBe('ACTIVE');
  });

  it('GET /leases/:id/schedule returns the generated rent schedule', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/leases/${leaseId}/schedule`)
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);
  });
});
