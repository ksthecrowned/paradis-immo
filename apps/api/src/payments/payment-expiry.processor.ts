import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PaymentsService } from './payments.service';

/**
 * Spec 05 — expiration des paiements : toutes les 5 minutes, chaque paiement
 * `INITIATED` dont `expiresAt` est passé est d'abord interrogé chez le
 * fournisseur (`getStatus`) ; sans confirmation il passe en `EXPIRED` et
 * n'est jamais alloué.
 */
@Injectable()
export class PaymentExpiryProcessor {
  private readonly logger = new Logger(PaymentExpiryProcessor.name);

  constructor(private readonly payments: PaymentsService) {}

  @Cron('*/5 * * * *', { timeZone: 'Africa/Brazzaville' })
  async handleCron(): Promise<void> {
    const result = await this.runOnce();
    if (result.processed > 0) {
      this.logger.log(
        `Paiements: ${result.expired} expiré(s), ${result.confirmed} confirmé(s)`,
      );
    }
  }

  /** Public for direct invocation from tests. */
  async runOnce(now = new Date()): Promise<{
    processed: number;
    confirmed: number;
    expired: number;
  }> {
    return this.payments.expireDuePayments(now);
  }

  /**
   * Spec 05 — litiges : une réponse du gestionnaire est attendue sous 72 h,
   * sinon le litige est escaladé à l'admin plateforme.
   */
  @Cron('10 * * * *', { timeZone: 'Africa/Brazzaville' })
  async escalateCron(): Promise<void> {
    const result = await this.payments.escalateOverdueDisputes();
    if (result.escalated > 0) {
      this.logger.log(`Litiges escaladés: ${result.escalated}`);
    }
  }
}
