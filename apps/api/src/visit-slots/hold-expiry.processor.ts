import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { VisitSlotsService } from './visit-slots.service';

/**
 * Spec 06 — toutes les minutes : expiration des holds de visite payante
 * (booking PENDING dont holdExpiresAt < now → EXPIRED, créneau refree).
 */
@Injectable()
export class HoldExpiryProcessor {
  private readonly logger = new Logger(HoldExpiryProcessor.name);

  constructor(private readonly slots: VisitSlotsService) {}

  @Cron('* * * * *')
  async handleCron(): Promise<void> {
    const expired = await this.slots.expireHolds();
    if (expired > 0) {
      this.logger.log(`Expired ${expired} visit payment hold(s)`);
    }
  }
}
