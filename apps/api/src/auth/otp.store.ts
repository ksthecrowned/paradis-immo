import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const OTP_TTL_SECONDS = 5 * 60;

interface OtpRecord {
  code: string;
  attempts: number;
}

@Injectable()
export class OtpStore implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OtpStore.name);
  private client!: Redis;

  onModuleInit() {
    this.client = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 3,
      lazyConnect: false,
    });
    this.client.on('error', (err) => {
      this.logger.warn(`Redis error: ${err.message}`);
    });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit().catch(() => undefined);
    }
  }

  private key(phone: string): string {
    return `paradis-immo:otp:${phone}`;
  }

  async put(phone: string, code: string): Promise<void> {
    const record: OtpRecord = { code, attempts: 0 };
    await this.client.set(
      this.key(phone),
      JSON.stringify(record),
      'EX',
      OTP_TTL_SECONDS,
    );
  }

  async peek(phone: string): Promise<string | null> {
    const raw = await this.client.get(this.key(phone));
    if (!raw) return null;
    try {
      return (JSON.parse(raw) as OtpRecord).code;
    } catch {
      return null;
    }
  }

  async getWithAttempts(phone: string): Promise<OtpRecord | null> {
    const raw = await this.client.get(this.key(phone));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as OtpRecord;
    } catch {
      return null;
    }
  }

  async incrementAttempts(phone: string): Promise<OtpRecord | null> {
    const key = this.key(phone);
    const raw = await this.client.get(key);
    if (!raw) return null;
    const record = JSON.parse(raw) as OtpRecord;
    record.attempts += 1;
    const ttl = await this.client.ttl(key);
    await this.client.set(
      key,
      JSON.stringify(record),
      'EX',
      ttl > 0 ? ttl : OTP_TTL_SECONDS,
    );
    return record;
  }

  async del(phone: string): Promise<void> {
    await this.client.del(this.key(phone));
  }
}