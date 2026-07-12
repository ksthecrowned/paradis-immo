import type { INestApplication } from '@nestjs/common';
import type { OtpStore } from '../../src/auth/otp.store';
import request from 'supertest';

export async function loginWithOtp(
  app: INestApplication,
  otpStore: OtpStore,
  phone: string,
): Promise<{ token: string; userId: string }> {
  const loginAttempt = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/request')
    .send({ phone, purpose: 'LOGIN' });

  let purpose: 'LOGIN' | 'REGISTER' = 'LOGIN';
  if (loginAttempt.status === 404) {
    purpose = 'REGISTER';
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone, purpose: 'REGISTER' })
      .expect(202);
  } else {
    expect(loginAttempt.status).toBe(202);
  }

  const code = await otpStore.peek(phone);
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/otp/verify')
    .send({ phone, code: code!, purpose })
    .expect(200);
  return {
    token: login.body.accessToken as string,
    userId: login.body.user.id as string,
  };
}
