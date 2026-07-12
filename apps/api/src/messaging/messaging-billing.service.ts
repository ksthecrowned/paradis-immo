import { Injectable } from '@nestjs/common';
import {
  MessageChannel,
  MessageCharge,
  MessageChargeStatus,
  MessagePayerType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  billingMonthUtc,
  messagingConfig,
  phonePayerId,
  toXaf,
} from './messaging.config';

@Injectable()
export class MessagingBillingService {
  constructor(private readonly prisma: PrismaService) {}

  async recordOtp(
    phone: string,
    opts?: { providerMessageId?: string; idempotencyKey?: string },
  ): Promise<MessageCharge> {
    if (opts?.idempotencyKey) {
      const existing = await this.prisma.messageCharge.findUnique({
        where: { idempotencyKey: opts.idempotencyKey },
      });
      if (existing) return existing;
    }

    const cfg = messagingConfig();
    const month = billingMonthUtc();
    const user = await this.prisma.user.findFirst({ where: { phone } });
    const payerId = user?.id ?? phonePayerId(phone);

    const priorCount = await this.prisma.messageCharge.count({
      where: {
        channel: MessageChannel.WHATSAPP_OTP,
        billingMonth: month,
        OR: [
          { payerId },
          ...(user ? [{ userId: user.id }] : [{ payerId: phonePayerId(phone) }]),
        ],
      },
    });

    const isFree = priorCount < cfg.otpFreePerMonth;
    const unitUsd = isFree ? 0 : cfg.otpUnitUsd;
    const amountXaf = isFree ? 0 : toXaf(unitUsd, cfg.fxRate);
    const status = isFree ? MessageChargeStatus.FREE : MessageChargeStatus.OPEN;
    const idempotencyKey =
      opts?.idempotencyKey ?? `otp:${phone}:${month}:${priorCount + 1}`;

    try {
      return await this.prisma.messageCharge.create({
        data: {
          channel: MessageChannel.WHATSAPP_OTP,
          payerType: MessagePayerType.USER,
          payerId,
          userId: user?.id ?? null,
          recipientPhone: phone,
          billingMonth: month,
          unitUsd,
          fxRate: cfg.fxRate,
          amountXaf,
          status,
          providerMessageId: opts?.providerMessageId,
          idempotencyKey,
        },
      });
    } catch (err) {
      const again = await this.prisma.messageCharge.findUnique({
        where: { idempotencyKey },
      });
      if (again) return again;
      throw err;
    }
  }

  async recordSmsAlert(input: {
    phone: string;
    userId: string;
    organizationId: string;
    providerMessageId?: string;
    idempotencyKey?: string;
  }): Promise<MessageCharge> {
    if (input.idempotencyKey) {
      const existing = await this.prisma.messageCharge.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existing) return existing;
    }

    const cfg = messagingConfig();
    const month = billingMonthUtc();
    const unitUsd = cfg.smsUnitUsd;
    const amountXaf = toXaf(unitUsd, cfg.fxRate);
    const idempotencyKey =
      input.idempotencyKey ??
      `sms:${input.organizationId}:${input.phone}:${Date.now()}`;

    try {
      return await this.prisma.messageCharge.create({
        data: {
          channel: MessageChannel.SMS_ALERT,
          payerType: MessagePayerType.ORGANIZATION,
          payerId: input.organizationId,
          userId: input.userId,
          organizationId: input.organizationId,
          recipientPhone: input.phone,
          billingMonth: month,
          unitUsd,
          fxRate: cfg.fxRate,
          amountXaf,
          status: MessageChargeStatus.OPEN,
          providerMessageId: input.providerMessageId,
          idempotencyKey,
        },
      });
    } catch (err) {
      const again = await this.prisma.messageCharge.findUnique({
        where: { idempotencyKey },
      });
      if (again) return again;
      throw err;
    }
  }

  async attachPhoneChargesToUser(phone: string, userId: string): Promise<void> {
    await this.prisma.messageCharge.updateMany({
      where: {
        payerId: phonePayerId(phone),
        payerType: MessagePayerType.USER,
      },
      data: {
        payerId: userId,
        userId,
      },
    });
  }

  async openBalanceXaf(
    payerType: MessagePayerType,
    payerId: string,
  ): Promise<number> {
    const rows = await this.prisma.messageCharge.findMany({
      where: {
        payerType,
        payerId,
        status: MessageChargeStatus.OPEN,
      },
      select: { amountXaf: true },
    });
    return rows.reduce((sum, r) => sum + r.amountXaf, 0);
  }

  async listOpenCharges(
    payerType: MessagePayerType,
    payerId: string,
  ): Promise<MessageCharge[]> {
    return this.prisma.messageCharge.findMany({
      where: {
        payerType,
        payerId,
        status: MessageChargeStatus.OPEN,
      },
      orderBy: { occurredAt: 'asc' },
    });
  }

  async settleCharges(paymentId: string, chargeIds: string[]): Promise<void> {
    if (chargeIds.length === 0) return;
    await this.prisma.messageCharge.updateMany({
      where: {
        id: { in: chargeIds },
        status: MessageChargeStatus.OPEN,
      },
      data: {
        status: MessageChargeStatus.SETTLED,
        settledPaymentId: paymentId,
      },
    });
  }
}
