import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { BookingsService } from './bookings.service';

/**
 * Spec 07 — toutes les minutes :
 * 1. expiration des holds de séjour PENDING_PAYMENT (15 min sans paiement →
 *    EXPIRED, dates refree) ;
 * 2. expiration des demandes REQUESTED (24 h sans réponse) et des ACCEPTED
 *    (hold 2 h sans paiement).
 */
@Injectable()
export class HoldExpiryProcessor {
  private readonly logger = new Logger(HoldExpiryProcessor.name);

  constructor(private readonly bookings: BookingsService) {}

  @Cron('* * * * *')
  async handleCron(): Promise<void> {
    const expiredHolds = await this.bookings.expireHolds();
    if (expiredHolds > 0) {
      this.logger.log(`Expired ${expiredHolds} stay payment hold(s)`);
    }
    const expiredRequests = await this.bookings.expireRequestsAndAccepted();
    if (expiredRequests > 0) {
      this.logger.log(`Expired ${expiredRequests} request/accepted booking(s)`);
    }
  }
}
