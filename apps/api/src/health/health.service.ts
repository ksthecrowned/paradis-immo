import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface HealthReport {
  status: 'ok' | 'degraded';
  db: 'up' | 'down';
}

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);

  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthReport> {
    const dbResult = await this.checkDb();
    return {
      status: dbResult === 'up' ? 'ok' : 'degraded',
      db: dbResult,
    };
  }

  private async checkDb(): Promise<'up' | 'down'> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch (err) {
      this.logger.warn(`DB health check failed: ${err}`);
      return 'down';
    }
  }
}
