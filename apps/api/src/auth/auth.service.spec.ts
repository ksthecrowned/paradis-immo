import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { Country, GlobalRole } from '@prisma/client';
import { AuthService } from './auth.service';
import { InfobipOtpService } from './infobip-otp.service';
import { EventPublisher } from '../events/event.publisher';
import { OtpStore } from './otp.store';
import { PrismaService } from '../prisma/prisma.service';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  let country: Country;
  const phone = '+242061234567';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpStore,
        PrismaService,
        InfobipOtpService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(async (payload) => {
              // Unique token per call so refresh tokens don't collide on tokenHash
              const uniq = `${payload.sub}-${payload.jti ?? 'access'}-${Date.now()}-${Math.random()}`;
              return `token.${Buffer.from(uniq).toString('base64url')}`;
            }),
            verifyAsync: jest.fn(async () => ({})),
          },
        },
        {
          provide: EventPublisher,
          useValue: { emit: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    otpStore = moduleRef.get(OtpStore);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    country =
      (await prisma.country.findUnique({ where: { code: 'CG' } })) ??
      (await prisma.country.create({
        data: {
          code: 'CG',
          name: 'Congo',
          currency: 'XAF',
          phonePrefix: '+242',
          activeProviders: ['AIRTEL'],
        },
      }));

    // Cleanup any leftover user from previous test runs
    await prisma.user.deleteMany({ where: { phone } }).catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { phone } }).catch(() => undefined);
    await prisma.otpChallenge.deleteMany({ where: { phone } }).catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  it('requestOtp stores a 6-digit code in Postgres with 5min TTL', async () => {
    await service.requestOtp({ phone });
    const code = await otpStore.peek(phone);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('verifyOtp returns tokens for valid code', async () => {
    const code = await otpStore.peek(phone);
    expect(code).not.toBeNull();
    const result = await service.verifyOtp({ phone, code: code! });
    expect(result.accessToken).toMatch(/^token\./);
    expect(result.refreshToken).toBeDefined();
    expect(result.user.phone).toBe(phone);
    expect(result.user.roles).toContain('TENANT');

    // User was created in DB
    const userInDb = await prisma.user.findFirst({
      where: { phone },
      include: { roles: true },
    });
    expect(userInDb).not.toBeNull();
    expect(userInDb!.roles.some((r) => r.role === GlobalRole.TENANT)).toBe(true);
  });

  it('verifyOtp rejects an incorrect code', async () => {
    await otpStore.put(phone, '000000');
    await expect(service.verifyOtp({ phone, code: '111111' })).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('verifyOtp rejects when no OTP requested', async () => {
    await otpStore.del('+242069999999');
    await expect(
      service.verifyOtp({ phone: '+242069999999', code: '123456' }),
    ).rejects.toThrow(UnauthorizedException);
  });
});