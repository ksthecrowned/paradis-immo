import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let otpStore: OtpStore;
  const phone = '+242065555555';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    otpStore = moduleRef.get(OtpStore);
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/otp/request returns 202', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone })
      .expect(202);
    expect(res.body.message).toBe('OTP sent');
  });

  it('POST /auth/otp/verify with wrong code returns 401 OTP_INVALID', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: '000000' })
      .expect(401);
    expect(res.body.code).toBe('OTP_INVALID');
  });

  it('POST /auth/otp/verify with correct code returns tokens', async () => {
    const code = await otpStore.peek(phone);
    expect(code).toMatch(/^\d{6}$/);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.phone).toBe(phone);
    expect(res.body.user.roles).toContain('TENANT');
  });

  it('POST /auth/refresh issues new tokens and revokes old', async () => {
    // Request fresh OTP (the previous one was consumed)
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone })
      .expect(202);
    const newCode = await otpStore.peek(phone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: newCode! })
      .expect(200);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refresh.body.accessToken).toBeDefined();

    // Reusing the rotated refresh token must fail
    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });
});