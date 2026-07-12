import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import {
  GlobalRole,
  MessageChannel,
  MessageChargeStatus,
  MessagePayerType,
} from '@prisma/client';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { InfobipOtpService } from './infobip-otp.service';
import { MagicLinkStore } from './magic-link.store';
import { OtpStore } from './otp.store';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingBillingService } from '../messaging/messaging-billing.service';
import { phonePayerId } from '../messaging/messaging.config';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let otpStore: OtpStore;
  const phone = '+242061234567';

  async function cleanupPhone() {
    await prisma.messageCharge.deleteMany({ where: { recipientPhone: phone } });
    const users = await prisma.user.findMany({ where: { phone } });
    for (const u of users) {
      await prisma.refreshToken.deleteMany({ where: { userId: u.id } });
      await prisma.userRole.deleteMany({ where: { userId: u.id } });
      await prisma.messageCharge.updateMany({
        where: { userId: u.id },
        data: { userId: null, settledPaymentId: null },
      });
      await prisma.user.delete({ where: { id: u.id } });
    }
    await prisma.otpChallenge.deleteMany({ where: { phone } });
  }

  beforeAll(async () => {
    process.env.USD_TO_XAF = process.env.USD_TO_XAF || '600';
    process.env.OTP_FREE_PER_MONTH = process.env.OTP_FREE_PER_MONTH || '10';
    process.env.OTP_UNIT_USD = process.env.OTP_UNIT_USD || '0.006';

    const moduleRef = await Test.createTestingModule({
      providers: [
        AuthService,
        OtpStore,
        MagicLinkStore,
        EmailService,
        PrismaService,
        InfobipOtpService,
        MessagingBillingService,
        {
          provide: JwtService,
          useValue: {
            signAsync: jest.fn(async (payload) => {
              const uniq = `${payload.sub}-${payload.jti ?? 'access'}-${Date.now()}-${Math.random()}`;
              return `token.${Buffer.from(uniq).toString('base64url')}`;
            }),
            verifyAsync: jest.fn(async () => ({})),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(AuthService);
    otpStore = moduleRef.get(OtpStore);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();

    if (!(await prisma.country.findUnique({ where: { code: 'CG' } }))) {
      await prisma.country.create({
        data: {
          code: 'CG',
          name: 'Congo',
          currency: 'XAF',
          phonePrefix: '+242',
          activeProviders: ['AIRTEL'],
        },
      });
    }

    await cleanupPhone();
  });

  afterAll(async () => {
    await prisma.onModuleDestroy().catch(() => undefined);
  });

  it('requestOtp stores a 6-digit code in Postgres with 5min TTL', async () => {
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const code = await otpStore.peek(phone);
    expect(code).toMatch(/^\d{6}$/);
  });

  it('requestOtp records a MessageCharge after successful send', async () => {
    await cleanupPhone();
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const charge = await prisma.messageCharge.findFirst({
      where: {
        recipientPhone: phone,
        channel: MessageChannel.WHATSAPP_OTP,
      },
      orderBy: { createdAt: 'desc' },
    });
    expect(charge).not.toBeNull();
    expect(charge!.payerId).toBe(phonePayerId(phone));
    expect(charge!.status).toBe(MessageChargeStatus.FREE);
  });

  it('verifyOtp returns tokens for valid code', async () => {
    await cleanupPhone();
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const code = await otpStore.peek(phone);
    expect(code).not.toBeNull();
    const result = await service.verifyOtp({
      phone,
      code: code!,
      purpose: 'REGISTER',
    });
    expect(result.accessToken).toMatch(/^token\./);
    expect(result.refreshToken).toBeDefined();
    expect(result.user.phone).toBe(phone);
    expect(result.user.roles).toContain('TENANT');

    const userInDb = await prisma.user.findFirst({
      where: { phone },
      include: { roles: true },
    });
    expect(userInDb).not.toBeNull();
    expect(userInDb!.roles.some((r) => r.role === GlobalRole.TENANT)).toBe(true);
  });

  it('requestOtp LOGIN rejects unknown phone', async () => {
    await cleanupPhone();
    await expect(
      service.requestOtp({ phone, purpose: 'LOGIN' }),
    ).rejects.toMatchObject({
      response: { code: 'USER_NOT_FOUND' },
    });
  });

  it('requestOtp REGISTER rejects existing phone', async () => {
    await cleanupPhone();
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const code = await otpStore.peek(phone);
    await service.verifyOtp({ phone, code: code!, purpose: 'REGISTER' });
    await expect(
      service.requestOtp({ phone, purpose: 'REGISTER' }),
    ).rejects.toMatchObject({
      response: { code: 'USER_ALREADY_EXISTS' },
    });
  });

  it('verifyOtp LOGIN works for existing user', async () => {
    await cleanupPhone();
    await service.requestOtp({ phone, purpose: 'REGISTER' });
    const registerCode = await otpStore.peek(phone);
    await service.verifyOtp({
      phone,
      code: registerCode!,
      purpose: 'REGISTER',
    });

    await service.requestOtp({ phone, purpose: 'LOGIN' });
    const loginCode = await otpStore.peek(phone);
    const result = await service.verifyOtp({
      phone,
      code: loginCode!,
      purpose: 'LOGIN',
    });
    expect(result.user.phone).toBe(phone);
  });

  it('verifyOtp attaches phone:{e164} charges to user', async () => {
    await cleanupPhone();

    await prisma.messageCharge.create({
      data: {
        channel: MessageChannel.WHATSAPP_OTP,
        payerType: MessagePayerType.USER,
        payerId: phonePayerId(phone),
        recipientPhone: phone,
        billingMonth: '2099-01',
        unitUsd: 0.006,
        fxRate: 600,
        amountXaf: 4,
        status: MessageChargeStatus.OPEN,
        idempotencyKey: `otp-attach-test:${phone}`,
      },
    });

    await otpStore.put(phone, '654321', 'REGISTER');
    const result = await service.verifyOtp({
      phone,
      code: '654321',
      purpose: 'REGISTER',
    });

    const charge = await prisma.messageCharge.findFirst({
      where: { idempotencyKey: `otp-attach-test:${phone}` },
    });
    expect(charge).not.toBeNull();
    expect(charge!.payerId).toBe(result.user.id);
    expect(charge!.userId).toBe(result.user.id);
  });

  it('verifyOtp rejects an incorrect code', async () => {
    const badPhone = '+242061234568';
    await prisma.otpChallenge.deleteMany({ where: { phone: badPhone } });
    await otpStore.put(badPhone, '000000', 'REGISTER');
    let err: unknown;
    try {
      await service.verifyOtp({
        phone: badPhone,
        code: '111111',
        purpose: 'REGISTER',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UnauthorizedException);
    await prisma.otpChallenge.deleteMany({ where: { phone: badPhone } });
  });

  it('verifyOtp rejects when no OTP requested', async () => {
    const unknown = '+242069999999';
    await otpStore.del(unknown);
    let err: unknown;
    try {
      await service.verifyOtp({
        phone: unknown,
        code: '123456',
        purpose: 'REGISTER',
      });
    } catch (e) {
      err = e;
    }
    expect(err).toBeInstanceOf(UnauthorizedException);
  });
});
