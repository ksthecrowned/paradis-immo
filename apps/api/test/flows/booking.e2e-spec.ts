import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { OtpStore } from '../../src/auth/otp.store';
import { EventPublisher } from '../../src/events/event.publisher';
import { PrismaService } from '../../src/prisma/prisma.service';
import { loginWithOtp } from './helpers';

describe('Flow — short-term booking overlap rejected (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;

  const tenantPhone = '+242069300001';
  let tenantToken: string;
  let propertyId: string;
  let firstBookingId: string;

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

    const tenantLogin = await loginWithOtp(app, otpStore, tenantPhone);
    tenantToken = tenantLogin.token;
    const ownerId = tenantLogin.userId;

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'Flow Short Stay Property',
        description: 'E2E booking overlap',
        type: 'APARTMENT',
        mode: 'RENT_SHORT',
        price: 35000,
        currency: 'XAF',
        priceUnit: 'NIGHT',
        quartierId: quartier.id,
        address: 'Booking overlap test',
        countryId: cg.id,
        ownerId,
        organizationId: 'org_paradis_immo',
      },
    });
    propertyId = property.id;
  });

  afterAll(async () => {
    if (firstBookingId) {
      await prisma.availabilityBlock.deleteMany({ where: { refId: firstBookingId } });
      await prisma.booking.delete({ where: { id: firstBookingId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await app.close();
  });

  it('creates the first short-stay booking', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId,
        startDate: '2026-08-01T00:00:00.000Z',
        endDate: '2026-08-05T00:00:00.000Z',
      })
      .expect(201);
    expect(res.body.status).toBe('CONFIRMED');
    firstBookingId = res.body.id;
  });

  it('rejects an overlapping booking on the same property', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId,
        startDate: '2026-08-03T00:00:00.000Z',
        endDate: '2026-08-07T00:00:00.000Z',
      })
      .expect(409)
      .expect((res) => {
        expect(res.body.message).toMatch(/overlap|BOOKING_OVERLAP/i);
      });
  });

  it('allows a non-overlapping booking after the first stay', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/bookings')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        propertyId,
        startDate: '2026-08-10T00:00:00.000Z',
        endDate: '2026-08-12T00:00:00.000Z',
      })
      .expect(201);
    expect(res.body.status).toBe('CONFIRMED');

    await prisma.availabilityBlock.deleteMany({ where: { refId: res.body.id } });
    await prisma.booking.delete({ where: { id: res.body.id } });
  });
});
