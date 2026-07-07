import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { EventPublisher } from '../src/events/event.publisher';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Visits flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const visitorPhone = '+242068888886';
  let visitorToken: string;
  let propertyId: string;
  let templateId: string;
  let slotId: string;
  let bookingId: string;

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
      .send({ phone: visitorPhone })
      .expect(202);
    const code = await otpStore.peek(visitorPhone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: visitorPhone, code: code! })
      .expect(200);
    visitorToken = login.body.accessToken;
    const ownerId = login.body.user.id;

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'E2E Visit Property',
        description: 'A property for visit e2e tests',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Test visit address',
        countryId: cg.id,
        ownerId,
        organizationId: 'org_paradis_immo',
        visitEnabled: true,
        visitType: 'FREE',
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (bookingId) {
      await prisma.visitBooking.delete({ where: { id: bookingId } }).catch(() => undefined);
    }
    if (slotId) {
      await prisma.visitSlot.delete({ where: { id: slotId } }).catch(() => undefined);
    }
    if (templateId) {
      await prisma.visitSlotTemplate.delete({ where: { id: templateId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await app.close();
  });

  it('GET /properties/:id/visit-slots returns available slots (initially empty)', async () => {
    const res = await request(app.getHttpServer())
      .get(`/api/v1/properties/${propertyId}/visit-slots`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
