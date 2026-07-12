import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Payments flow (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const tenantPhone = '+242068888881';
  const agentPhone = '+242068888882';
  let tenantToken: string;
  let paymentId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    prisma = moduleRef.get(PrismaService);
    otpStore = moduleRef.get(OtpStore);

    // Login as tenant
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone: tenantPhone, purpose: 'REGISTER' })
      .expect(202);
    const code = await otpStore.peek(tenantPhone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone: tenantPhone, code: code!, purpose: 'REGISTER' })
      .expect(200);
    tenantToken = login.body.accessToken;
  });

  afterAll(async () => {
    // Cleanup: delete the payment created during the test
    if (paymentId) {
      await prisma.paymentAllocation.deleteMany({ where: { paymentId } });
      await prisma.payment.delete({ where: { id: paymentId } }).catch(() => undefined);
    }
    await prisma.user.deleteMany({ where: { phone: { in: [tenantPhone, agentPhone] } } });
    await app.close();
  });

  it('POST /payments creates a CASH payment in PENDING_VALIDATION', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({
        amount: 10000,
        currency: 'XAF',
        method: 'CASH',
        idempotencyKey: `e2e-${Date.now()}`,
      })
      .expect(201);
    expect(res.body.status).toBe('PENDING_VALIDATION');
    expect(res.body.idempotencyKey).toBeDefined();
    paymentId = res.body.id;
  });

  it('POST /payments with same idempotencyKey returns the same payment', async () => {
    const key = `e2e-idem-${Date.now()}`;
    const first = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ amount: 5000, currency: 'XAF', method: 'CASH', idempotencyKey: key })
      .expect(201);
    const second = await request(app.getHttpServer())
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${tenantToken}`)
      .send({ amount: 5000, currency: 'XAF', method: 'CASH', idempotencyKey: key })
      .expect(201);
    expect(first.body.id).toBe(second.body.id);
    // Cleanup
    await prisma.paymentAllocation.deleteMany({ where: { paymentId: first.body.id } });
    await prisma.payment.delete({ where: { id: first.body.id } });
  });

  it('GET /payments/my lists the tenant payments', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payments/my')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /payments/pending-validation is accessible to authenticated users', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/payments/pending-validation')
      .set('Authorization', `Bearer ${tenantToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
