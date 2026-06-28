import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';

describe('Users endpoints (e2e)', () => {
  let app: INestApplication;
  let otpStore: OtpStore;
  let jwt: JwtService;
  let accessToken: string;
  const phone = '+242063333333';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    otpStore = moduleRef.get(OtpStore);
    jwt = moduleRef.get(JwtService);

    // Provision a user via OTP and grab their real access token
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone })
      .expect(202);
    const code = await otpStore.peek(phone);
    const verify = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code })
      .expect(200);
    accessToken = verify.body.accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /users/me without token returns 401', async () => {
    await request(app.getHttpServer()).get('/api/v1/users/me').expect(401);
  });

  it('GET /users/me returns the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(res.body.phone).toBe(phone);
    expect(res.body.roles).toContain('TENANT');
  });

  it('PATCH /users/me updates name and avatarUrl', async () => {
    const res = await request(app.getHttpServer())
      .patch('/api/v1/users/me')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Marie Test',
        avatarUrl: 'https://cdn.example.com/a/marie.png',
      })
      .expect(200);
    expect(res.body.name).toBe('Marie Test');
    expect(res.body.avatarUrl).toBe('https://cdn.example.com/a/marie.png');
  });

  it('GET /users/me/organizations returns empty for a fresh user', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/v1/users/me/organizations')
      .set('Authorization', `Bearer ${accessToken}`)
      .expect(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body).toEqual([]);
  });
});
