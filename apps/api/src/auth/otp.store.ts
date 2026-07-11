import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const OTP_TTL_SECONDS = 5 * 60;

interface OtpRecord {
  code: string;
  attempts: number;
}

@Injectable()
export class OtpStore {
  private readonly logger = new Logger(OtpStore.name);

  constructor(private readonly prisma: PrismaService) {}

  async put(phone: string, code: string): Promise<void> {
    const expiresAt = new Date(Date.now() + OTP_TTL_SECONDS * 1000);
    await this.prisma.otpChallenge.upsert({
      where: { phone },
      create: {
        phone,
        code,
        attempts: 0,
        expiresAt,
        requestCount: 1,
        requestWindowEndAt: new Date(Date.now() + 3600 * 1000),
      },
      update: {
        code,
        attempts: 0,
        expiresAt,
      },
    });
  }

  async peek(phone: string): Promise<string | null> {
    const row = await this.prisma.otpChallenge.findUnique({ where: { phone } });
    if (!row || row.expiresAt < new Date()) return null;
    return row.code;
  }

  async getWithAttempts(phone: string): Promise<OtpRecord | null> {
    const row = await this.prisma.otpChallenge.findUnique({ where: { phone } });
    if (!row || row.expiresAt < new Date()) return null;
    return { code: row.code, attempts: row.attempts };
  }

  async incrementAttempts(phone: string): Promise<OtpRecord | null> {
    const row = await this.prisma.otpChallenge.findUnique({ where: { phone } });
    if (!row || row.expiresAt < new Date()) return null;
    const updated = await this.prisma.otpChallenge.update({
      where: { phone },
      data: { attempts: { increment: 1 } },
    });
    return { code: updated.code, attempts: updated.attempts };
  }

  async del(phone: string): Promise<void> {
    await this.prisma.otpChallenge.deleteMany({ where: { phone } });
  }

  async incrementRequestCount(
    phone: string,
    windowSeconds = 3600,
  ): Promise<number> {
    const now = new Date();
    const windowEnd = new Date(now.getTime() + windowSeconds * 1000);
    const existing = await this.prisma.otpChallenge.findUnique({
      where: { phone },
    });

    if (!existing || existing.requestWindowEndAt <= now) {
      const count = 1;
      await this.prisma.otpChallenge.upsert({
        where: { phone },
        create: {
          phone,
          code: '',
          attempts: 0,
          expiresAt: now,
          requestCount: count,
          requestWindowEndAt: windowEnd,
        },
        update: {
          requestCount: count,
          requestWindowEndAt: windowEnd,
        },
      });
      return count;
    }

    const updated = await this.prisma.otpChallenge.update({
      where: { phone },
      data: { requestCount: { increment: 1 } },
    });
    return updated.requestCount;
  }
}
