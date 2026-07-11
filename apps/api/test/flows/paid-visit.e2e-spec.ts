import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { OtpStore } from '../../src/auth/otp.store';
import { EventPublisher } from '../../src/events/event.publisher';
import { PrismaService } from '../../src/prisma/prisma.service';
import { loginWithOtp } from './helpers';
import { SEED_IDS } from '../../../src/common/constants/seed-ids';

describe('Flow — paid visit book → pay → confirm → slot BOOKED (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;

  const tenantPhone = '+242069200001';
  const managerPhone = '+242069200002';

  let tenantToken: string;
  let managerToken: string;
  let managerId: string;
  let propertyId: string;
  let slotId: string;
  let bookingId: string;
  let paymentId: string;

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

    const managerLogin = await loginWithOtp(app, otpStore, managerPhone);
    managerToken = managerLogin.token;
    managerId = managerLogin.userId;

    const cg = await prisma.country.findUnique({ where: { code: 'CG' } });
    const quartier = await prisma.quartier.findFirst();
    if (!cg || !quartier) throw new Error('Seed required first');

    const property = await prisma.property.create({
      data: {
        title: 'Flow Paid Visit Property',
        description: 'E2E paid visit',
        type: 'APARTMENT',
        mode: 'RENT_LONG',
        price: 100000,
        currency: 'XAF',
        priceUnit: 'MONTH',
        quartierId: quartier.id,
        address: 'Paid visit test',
        countryId: cg.id,
        ownerId: managerId,
        organizationId: SEED_IDS.orgParadisImmo,
        visitEnabled: true,
        visitType: 'PAID',
        visitPrice: 5000,
        visitDuration: 30,
      },
    });
    propertyId = property.id;

    const startAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    startAt.setUTCMinutes(0, 0, 0);
    const endAt = new Date(startAt.getTime() + 30 * 60 * 1000);
    const slot = await prisma.visitSlot.create({
      data: {
        propertyId,
        startAt,
        endAt,
        status: 'AVAILABLE',
        source: 'MANUAL',
      },
    });
    slotId = slot.id;
  });

  afterAll(async () => {
    if (paymentId) {
      await prisma.paymentAllocation.deleteMany({ where: { paymentId } });
      await prisma.payment.delete({ where: { id: paymentId } }).catch(() => undefined);
    }
    if (bookingId) {
      await prisma.visitBooking.delete({ where: { id: bookingId } }).catch(() => undefined);
    }
    if (slotId) {
      await prisma.visitSlot.delete({ where: { id: slotId } }).catch(() => undefined);
    }
    await prisma.property.delete({ where: { id: propertyId } }).catch(() => undefined);
    await app.close();
  });

  it('tenant books a paid visit (PENDING, slot stays AVAILABLE)', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/visits')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ propertyId, slotId })
      .expect(201);
    expect(res.body.status).toBe('PENDING');
    bookingId = res.body.id;

    const slot = await prisma.visitSlot.findUnique({ where: { id: slotId } });
    expect(slot?.status).toBe('AVAILABLE');
  });

  it('tenant initiates cash payment for the visit', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        amount: 5000,
        currency: 'XAF',
        method: 'CASH',
        idempotencyKey: `flow-paid-visit-${Date.now()}`,
      })
      .expect(201);
    expect(res.body.status).toBe('PENDING_VALIDATION');
    paymentId = res.body.id;
  });

  it('manager validates payment with VISIT_BOOKING allocation', async () => {
    await request(app.getHttpServer())
      .post(`/api/v1/payments/${paymentId}/validate`)
      .set('Authorization', `Bearer ${managerToken}`)
      .send({
        allocations: [
          {
            type: 'VISIT_BOOKING',
            refId: bookingId,
            amount: 5000,
          },
        ],
      })
      .expect(200)
      .expect((res) => {
        expect(res.body.status).toBe('VALIDATED');
      });
  });

  it('manager confirms visit and slot becomes BOOKED', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/api/v1/visits/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${managerToken}`)
      .expect(200);
    expect(res.body.status).toBe('CONFIRMED');

    const slot = await prisma.visitSlot.findUnique({ where: { id: slotId } });
    expect(slot?.status).toBe('BOOKED');
  });
});
