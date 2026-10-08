import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 05 US 2 — le payeur reçoit le résultat de son paiement : échec
 * fournisseur ou expiration (le succès est couvert par
 * `PAYMENT_RECEIPT_READY` de PaymentValidatedProcessor).
 */
@Injectable()
export class PaymentOutcomeProcessor {
  private readonly logger = new Logger(PaymentOutcomeProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.PAYMENT_FAILED)
  async handleFailed(
    event: DomainEvent<{
      paymentId: string;
      userId: string;
      amount: string;
      currency: string;
      reason: string | null;
    }>,
  ): Promise<void> {
    await this.notify(event.payload, 'PAYMENT_FAILED', 'Paiement échoué');
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_EXPIRED)
  async handleExpired(
    event: DomainEvent<{
      paymentId: string;
      userId: string;
      amount: string;
      currency: string;
      reason: string | null;
    }>,
  ): Promise<void> {
    await this.notify(event.payload, 'PAYMENT_EXPIRED', 'Paiement expiré');
  }

  private async notify(
    payload: {
      paymentId: string;
      userId: string;
      amount: string;
      currency: string;
      reason: string | null;
    },
    type: 'PAYMENT_FAILED' | 'PAYMENT_EXPIRED',
    label: string,
  ): Promise<void> {
    if (!payload.paymentId) {
      this.logger.warn(`${type} event missing paymentId`);
      return;
    }
    try {
      await this.notifications.send({
        userId: payload.userId,
        type,
        payload: {
          paymentId: payload.paymentId,
          amount: payload.amount,
          currency: payload.currency,
          reason: payload.reason,
          label,
        },
      });
    } catch (err) {
      this.logger.warn(`${type} notification failed: ${String(err)}`);
    }
  }
}
