import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { DOMAIN_EVENTS } from '../../events/event.types';
import { ReceiptService } from './receipt.service';

export const PAYMENT_VALIDATED_QUEUE = DOMAIN_EVENTS.PAYMENT_VALIDATED;

/**
 * Consumes `PAYMENT_VALIDATED` events and triggers receipt generation.
 *
 * The actual heavy lifting (PDF render + R2 upload + Receipt row) is in
 * `ReceiptService.generateForPayment`, which is idempotent on `paymentId`.
 */
@Injectable()
export class PaymentValidatedProcessor implements OnModuleInit {
  private readonly logger = new Logger(PaymentValidatedProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(private readonly receipts: ReceiptService) {}

  onModuleInit(): Promise<void> {
    if (!process.env.REDIS_URL) {
      this.logger.warn(
        'REDIS_URL not set — skipping PAYMENT_VALIDATED processor (receipts will not auto-generate)',
      );
      return Promise.resolve();
    }
    const u = new URL(process.env.REDIS_URL);
    const connection = {
      host: u.hostname || 'localhost',
      port: Number(u.port || 6379),
      ...(u.password ? { password: decodeURIComponent(u.password) } : {}),
    };

    this.queue = new Queue(PAYMENT_VALIDATED_QUEUE, { connection });
    this.worker = new Worker(
      PAYMENT_VALIDATED_QUEUE,
      async (job) => {
        const payload = (job.data as { payload?: unknown }).payload as
          | {
              paymentId: string;
              userId: string;
              amount: string;
              currency: string;
            }
          | undefined;
        if (!payload?.paymentId) {
          this.logger.warn(
            `PAYMENT_VALIDATED job ${job.id} missing paymentId payload`,
          );
          return { skipped: true };
        }
        const result = await this.receipts.generateForPayment(
          payload.paymentId,
        );
        this.logger.log(
          `Receipt ${result.number} generated for payment ${payload.paymentId}`,
        );
        return result;
      },
      { connection },
    );
    return Promise.resolve();
  }
}
