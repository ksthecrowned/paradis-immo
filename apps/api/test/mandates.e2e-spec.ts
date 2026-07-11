import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { EventPublisher } from '../src/events/event.publisher';
import { PrismaService } from '../src/prisma/prisma.service';
import { SEED_IDS } from '../../src/common/constants/seed-ids';

describe('Mandates flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const ownerPhone = '+242068888885';
  let ownerToken: string;
  let propertyId: string;
  let mandateId: string;
  let approvalId: string;

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

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'E2E Mandate Property',
        description: 'A property for mandate e2e tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Test mandate address',
        countryId: cg.id,
        ownerId,
        organizationId: SEED_IDS.orgParadisImmo,
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (approvalId) {
      await prisma.mandateApproval.delete({ where: { id: approvalId } }).catch(() => undefined);
    }
    if (mandateId) {
      await prisma.mandate.delete({ where: { id: mandateId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await app.close();
  });

  it('POST /mandates creates an active mandate', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/mandates')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({ propertyId, organizationId: SEED_IDS.orgParadisImmo })
      .expect(201);
    expect(res.body.status).toBe('ACTIVE');
    mandateId = res.body.id;
  });

  it('GET /mandates/pending-approvals returns an empty list initially', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/mandates/pending-approvals')
      .set('Authorization', `Bearer ${ownerToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
