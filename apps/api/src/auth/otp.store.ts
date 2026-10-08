import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const OTP_TTL_SECONDS = 5 * 60;

/** Spec 01 — OTP abuse controls. */
export const OTP_MAX_REQUESTS_PER_WINDOW = 3;
export const OTP_WINDOW_SECONDS = 15 * 60;
export const OTP_MIN_GAP_SECONDS = 60;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_SECONDS = 30 * 60;
export const OTP_MAX_PER_IP_PER_HOUR = 10;

export type OtpPurpose =
  | 'LOGIN'
  | 'REGISTER'
  | 'PHONE_CHANGE'
  | 'MANDATE_SIGN'
  /** Spec 04 — electronic signature of a lease. */
  | 'LEASE_SIGN'
  /** Spec 04 — signature of a lease amendment (avenant). */
  | 'AMENDMENT_SIGN';

interface OtpRecord {
  code: string;
  attempts: number;
  purpose: OtpPurpose;
}

/** Outcome of a send attempt; `retryAfterSeconds` feeds the 429 payload. */
export interface OtpSendDecision {
  allowed: boolean;
  retryAfterSeconds: number;
  code?: 'OTP_RATE_LIMITED' | 'OTP_COOLDOWN' | 'OTP_LOCKED';
}

function secondsUntil(target: Date): number {
  return Math.max(1, Math.ceil((target.getTime() - Date.now()) / 1000));
}

/** Keep unknown stored purposes behaving like the historical REGISTER flow. */
function toPurpose(value: string): OtpPurpose {
  return value === 'LOGIN' ||
    value === 'PHONE_CHANGE' ||
    value === 'MANDATE_SIGN' ||
    value === 'LEASE_SIGN' ||
    value === 'AMENDMENT_SIGN'
    ? value
    : 'REGISTER';
}

@Injectable()
export class OtpStore {
  private readonly logger = new Logger(OtpStore.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Decide whether an OTP may be sent right now. Pure read — the caller records
   * the send with `put()` once it commits. Enforces, in order:
   *   - the 30-minute lock set by 5 failed verifications;
   *   - the 60-second gap between two sends to the same number;
   *   - at most 3 requests per number per 15 minutes;
   *   - at most 10 requests per IP per hour.
   */
  async decideSend(
    phone: string,
    ipAddress?: string,
  ): Promise<OtpSendDecision> {
    const now = new Date();
    const row = await this.prisma.otpChallenge.findUnique({ where: { phone } });

    if (row?.lockedUntil && row.lockedUntil > now) {
      return {
        allowed: false,
        retryAfterSeconds: secondsUntil(row.lockedUntil),
        code: 'OTP_LOCKED',
      };
    }

    if (row?.lastSentAt) {
      const nextAllowed = new Date(
        row.lastSentAt.getTime() + OTP_MIN_GAP_SECONDS * 1000,
      );
      if (nextAllowed > now) {
        return {
          allowed: false,
          retryAfterSeconds: secondsUntil(nextAllowed),
          code: 'OTP_COOLDOWN',
        };
      }
    }

    if (row && row.requestWindowEndAt > now) {
      if (row.requestCount >= OTP_MAX_REQUESTS_PER_WINDOW) {
        return {
          allowed: false,
          retryAfterSeconds: secondsUntil(row.requestWindowEndAt),
          code: 'OTP_RATE_LIMITED',
        };
      }
    }

    if (ipAddress) {
      const ipDecision = await this.checkIpWindow(ipAddress, now);
      if (!ipDecision.allowed) return ipDecision;
    }

    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Counts one request per source IP over a rolling one-hour window. */
  private async checkIpWindow(
    ipAddress: string,
    now: Date,
  ): Promise<OtpSendDecision> {
    const key = `otp:ip:${ipAddress}`;
    const entry = await this.prisma.rateLimitCounter.findUnique({
      where: { key },
    });
    if (entry && entry.windowEndAt > now) {
      if (entry.count >= OTP_MAX_PER_IP_PER_HOUR) {
        return {
          allowed: false,
          retryAfterSeconds: secondsUntil(entry.windowEndAt),
          code: 'OTP_RATE_LIMITED',
        };
      }
    }
    return { allowed: true, retryAfterSeconds: 0 };
  }

  /** Records the IP hit — called only once a send is actually allowed. */
  async recordIpRequest(ipAddress: string): Promise<void> {
    const now = new Date();
    const key = `otp:ip:${ipAddress}`;
    const windowEndAt = new Date(now.getTime() + 3600 * 1000);
    const entry = await this.prisma.rateLimitCounter.findUnique({
      where: { key },
    });
    if (!entry || entry.windowEndAt <= now) {
      await this.prisma.rateLimitCounter.upsert({
        where: { key },
        create: { key, count: 1, windowEndAt },
        update: { count: 1, windowEndAt },
      });
      return;
    }
    await this.prisma.rateLimitCounter.update({
      where: { key },
      data: { count: { increment: 1 } },
    });
  }

  /**
   * Store a code and count it against the per-number window. `lastSentAt` is
   * set here because `put` is the only place a send is committed.
   */
  async put(phone: string, code: string, purpose: OtpPurpose): Promise<void> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + OTP_TTL_SECONDS * 1000);
    const existing = await this.prisma.otpChallenge.findUnique({
      where: { phone },
    });

    const windowActive = existing && existing.requestWindowEndAt > now;
    const requestCount = windowActive ? existing.requestCount + 1 : 1;
    const requestWindowEndAt = windowActive
      ? existing.requestWindowEndAt
      : new Date(now.getTime() + OTP_WINDOW_SECONDS * 1000);

    await this.prisma.otpChallenge.upsert({
      where: { phone },
      create: {
        phone,
        code,
        purpose,
        attempts: 0,
        expiresAt,
        requestCount,
        requestWindowEndAt,
        lastSentAt: now,
        lockedUntil: null,
      },
      update: {
        code,
        purpose,
        attempts: 0,
        expiresAt,
        requestCount,
        requestWindowEndAt,
        lastSentAt: now,
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
    if (!row) return null;
    // A locked number stays readable even after the code itself expired, so
    // verification can answer OTP_LOCKED rather than OTP_NOT_FOUND.
    const locked = Boolean(row.lockedUntil && row.lockedUntil > new Date());
    if (row.expiresAt < new Date() && !locked) return null;
    return { code: row.code, attempts: row.attempts, purpose: toPurpose(row.purpose) };
  }

  /**
   * Count a failed verification. Reaching the limit locks the number for
   * 30 minutes (spec 01) instead of merely forgetting the challenge.
   */
  async incrementAttempts(phone: string): Promise<OtpRecord | null> {
    const row = await this.prisma.otpChallenge.findUnique({ where: { phone } });
    if (!row || row.expiresAt < new Date()) return null;
    const attempts = row.attempts + 1;
    const lockedUntil =
      attempts >= OTP_MAX_ATTEMPTS
        ? new Date(Date.now() + OTP_LOCK_SECONDS * 1000)
        : row.lockedUntil;
    const updated = await this.prisma.otpChallenge.update({
      where: { phone },
      data: { attempts, lockedUntil },
    });
    if (attempts >= OTP_MAX_ATTEMPTS) {
      this.logger.warn(
        `OTP locked for ${phone} after ${attempts} failed attempts`,
      );
    }
    return {
      code: updated.code,
      attempts: updated.attempts,
      purpose: toPurpose(updated.purpose),
    };
  }

  async del(phone: string): Promise<void> {
    await this.prisma.otpChallenge.deleteMany({ where: { phone } });
  }

  /** Kept for callers that only need the per-number window count. */
  async incrementRequestCount(
    phone: string,
    _windowSeconds = OTP_WINDOW_SECONDS,
  ): Promise<number> {
    const row = await this.prisma.otpChallenge.findUnique({ where: { phone } });
    return row?.requestCount ?? 0;
  }
}
