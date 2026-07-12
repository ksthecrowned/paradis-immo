import { Test } from '@nestjs/testing';
import {
  MessageChannel,
  MessageChargeStatus,
  MessagePayerType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MessagingBillingService } from './messaging-billing.service';
import { billingMonthUtc, phonePayerId, toXaf } from './messaging.config';

describe('MessagingBillingService', () => {
  let service: MessagingBillingService;
  let prisma: PrismaService;
  const phone = '+242061111001';
  const fx = 600;

  beforeAll(async () => {
    process.env.USD_TO_XAF = String(fx);
    process.env.OTP_FREE_PER_MONTH = '10';
    process.env.OTP_UNIT_USD = '0.006';
    process.env.SMS_ALERT_UNIT_USD = '0.234';

    const moduleRef = await Test.createTestingModule({
      providers: [MessagingBillingService, PrismaService],
    }).compile();

    service = moduleRef.get(MessagingBillingService);
    prisma = moduleRef.get(PrismaService);
    await prisma.onModuleInit();
  });

  beforeEach(async () => {
    await prisma.messageCharge.deleteMany({
      where: {
        OR: [{ recipientPhone: phone }, { payerId: phonePayerId(phone) }],
      },
    });
    await prisma.user.deleteMany({ where: { phone } }).catch(() => undefined);
  });

  afterAll(async () => {
    await prisma.messageCharge.deleteMany({
      where: {
        OR: [{ recipientPhone: phone }, { payerId: phonePayerId(phone) }],
      },
    });
    await prisma.user.deleteMany({ where: { phone } }).catch(() => undefined);
    await prisma.onModuleDestroy();
  });

  it('first 10 OTPs in month are FREE', async () => {
    const charges = [];
    for (let i = 0; i < 10; i++) {
      charges.push(await service.recordOtp(phone));
    }
    expect(charges).toHaveLength(10);
    expect(charges.every((c) => c.status === MessageChargeStatus.FREE)).toBe(true);
    expect(charges.every((c) => c.amountXaf === 0)).toBe(true);
    expect(charges.every((c) => c.channel === MessageChannel.WHATSAPP_OTP)).toBe(
      true,
    );
    expect(charges.every((c) => c.payerId === phonePayerId(phone))).toBe(true);
  });

  it('11th OTP is OPEN with XAF = round(0.006 * fx)', async () => {
    for (let i = 0; i < 10; i++) {
      await service.recordOtp(phone);
    }
    const eleventh = await service.recordOtp(phone);
    expect(eleventh.status).toBe(MessageChargeStatus.OPEN);
    expect(eleventh.amountXaf).toBe(toXaf(0.006, fx));
    expect(Number(eleventh.unitUsd)).toBe(0.006);
    expect(Number(eleventh.fxRate)).toBe(fx);
  });

  it('new UTC month resets free quota', async () => {
    const priorMonth = '2020-01';
    await prisma.messageCharge.create({
      data: {
        channel: MessageChannel.WHATSAPP_OTP,
        payerType: MessagePayerType.USER,
        payerId: phonePayerId(phone),
        recipientPhone: phone,
        billingMonth: priorMonth,
        unitUsd: 0,
        fxRate: fx,
        amountXaf: 0,
        status: MessageChargeStatus.FREE,
        idempotencyKey: `otp:${phone}:${priorMonth}:seed`,
      },
    });

    const current = await service.recordOtp(phone);
    expect(current.billingMonth).toBe(billingMonthUtc());
    expect(current.billingMonth).not.toBe(priorMonth);
    expect(current.status).toBe(MessageChargeStatus.FREE);
  });

  it('idempotent recordOtp same key returns same row', async () => {
    const key = `otp-test:${phone}:idem`;
    const a = await service.recordOtp(phone, { idempotencyKey: key });
    const b = await service.recordOtp(phone, { idempotencyKey: key });
    expect(b.id).toBe(a.id);
    const count = await prisma.messageCharge.count({
      where: { recipientPhone: phone, channel: MessageChannel.WHATSAPP_OTP },
    });
    expect(count).toBe(1);
  });

  it('attachPhoneChargesToUser rewrites payerId and userId', async () => {
    const charge = await service.recordOtp(phone);
    expect(charge.payerId).toBe(phonePayerId(phone));
    expect(charge.userId).toBeNull();

    const user = await prisma.user.create({
      data: {
        phone,
        countryId: (
          await prisma.country.upsert({
            where: { code: 'CG' },
            create: {
              code: 'CG',
              name: 'Congo',
              currency: 'XAF',
              phonePrefix: '+242',
              activeProviders: ['AIRTEL'],
            },
            update: {},
          })
        ).id,
      },
    });

    await service.attachPhoneChargesToUser(phone, user.id);

    const updated = await prisma.messageCharge.findUniqueOrThrow({
      where: { id: charge.id },
    });
    expect(updated.payerId).toBe(user.id);
    expect(updated.userId).toBe(user.id);
  });

  it('openBalanceXaf sums OPEN charges only', async () => {
    for (let i = 0; i < 11; i++) {
      await service.recordOtp(phone);
    }
    const balance = await service.openBalanceXaf(
      MessagePayerType.USER,
      phonePayerId(phone),
    );
    expect(balance).toBe(toXaf(0.006, fx));
  });
});
