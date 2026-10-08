import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PayoutsService } from './payouts.service';

/**
 * Spec 05 — cron mensuel de reversement : le 10 de chaque mois, chaque
 * organisation propriétaire à fréquence `MONTHLY` dont le solde du ledger
 * (hors montants en litige) atteint `minPayoutAmount` et qui dispose d'un
 * compte vérifié reçoit son reversement.
 */
@Injectable()
export class PayoutCronProcessor {
  private readonly logger = new Logger(PayoutCronProcessor.name);

  constructor(private readonly payouts: PayoutsService) {}

  @Cron('30 6 10 * * *', { timeZone: 'Africa/Brazzaville' })
  async handleCron(): Promise<void> {
    const result = await this.runMonthly();
    if (result.created > 0) {
      this.logger.log(
        `Reversements mensuels: ${result.created} créé(s), ${result.paid} payé(s), ${result.failed} échoué(s)`,
      );
    }
  }

  /** Public for direct invocation from tests. */
  async runMonthly(): Promise<{
    orgs: number;
    created: number;
    paid: number;
    failed: number;
  }> {
    return this.payouts.runMonthlyPayouts();
  }
}
