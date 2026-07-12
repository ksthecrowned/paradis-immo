import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { OtpStore } from '../src/auth/otp.store';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Auth flow (e2e)', () => {
  let app: INestApplication;
  let otpStore: OtpStore;
  let prisma: PrismaService;
  const phone = '+242065555555';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
    otpStore = moduleRef.get(OtpStore);
    prisma = moduleRef.get(PrismaService);

    const users = await prisma.user.findMany({ where: { phone } });
    for (const u of users) {
      await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.otpChallenge.deleteMany({ where: { phone } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /auth/otp/request LOGIN rejects unknown phone', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone, purpose: 'LOGIN' })
      .expect(404);
    expect(res.body.code).toBe('USER_NOT_FOUND');
  });

  it('POST /auth/otp/request REGISTER returns 202', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone, purpose: 'REGISTER' })
      .expect(202);
    expect(res.body.message).toBe('OTP sent');
  });

  it('POST /auth/otp/verify with wrong code returns 401 OTP_INVALID', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: '000000', purpose: 'REGISTER' })
      .expect(401);
    expect(res.body.code).toBe('OTP_INVALID');
  });

  it('POST /auth/otp/verify with correct code returns tokens', async () => {
    const code = await otpStore.peek(phone);
    expect(code).toMatch(/^\d{6}$/);
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code, purpose: 'REGISTER' })
      .expect(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.body.refreshToken).toBeDefined();
    expect(res.body.user.phone).toBe(phone);
    expect(res.body.user.roles).toContain('TENANT');
  });

  it('POST /auth/refresh issues new tokens and revokes old', async () => {
    await request(app.getHttpServer())
      .post('/api/v1/auth/otp/request')
      .send({ phone, purpose: 'LOGIN' })
      .expect(202);
    const newCode = await otpStore.peek(phone);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/otp/verify')
      .send({ phone, code: newCode!, purpose: 'LOGIN' })
      .expect(200);

    const refresh = await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(200);
    expect(refresh.body.accessToken).toBeDefined();

    await request(app.getHttpServer())
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: login.body.refreshToken })
      .expect(401);
  });
});
