import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { ReceiptService } from './receipt.service';

/**
 * Handles `PAYMENT_VALIDATED` events and triggers receipt generation.
 *
 * The actual heavy lifting (PDF render + R2 upload + Receipt row) is in
 * `ReceiptService.generateForPayment`, which is idempotent on `paymentId`.
 */
@Injectable()
export class PaymentValidatedProcessor {
  private readonly logger = new Logger(PaymentValidatedProcessor.name);

  constructor(private readonly receipts: ReceiptService) {}

  @OnEvent(DOMAIN_EVENTS.PAYMENT_VALIDATED)
  async handle(
    event: DomainEvent<{
      paymentId: string;
      userId: string;
      amount: string;
      currency: string;
    }>,
  ): Promise<void> {
    const { paymentId } = event.payload;
    if (!paymentId) {
      this.logger.warn('PAYMENT_VALIDATED event missing paymentId');
      return;
    }
    const result = await this.receipts.generateForPayment(paymentId);
    this.logger.log(
      `Receipt ${result.number} generated for payment ${paymentId}`,
    );
  }
}
