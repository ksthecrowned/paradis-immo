import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MemberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 05 US 2 / matrice 11 — le payeur reçoit le résultat de son paiement
 * (échec fournisseur, expiration), le gestionnaire reçoit l'ouverture d'un
 * litige, et le payeur reçoit le remboursement exécuté (REFUND_DONE).
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

  /** Spec 11 matrice — DISPUTE_OPENED → gestionnaire du périmètre. */
  @OnEvent(DOMAIN_EVENTS.PAYMENT_DISPUTED)
  async handleDisputed(
    event: DomainEvent<{
      paymentId: string;
      disputeId: string;
      openedBy: string;
      reason: string | null;
    }>,
  ): Promise<void> {
    const { paymentId, disputeId, reason } = event.payload;
    if (!paymentId || !disputeId) {
      this.logger.warn('PAYMENT_DISPUTED event missing ids');
      return;
    }
    let organizationId: string | null = null;
    try {
      organizationId = await this.resolveOrgForPayment(paymentId);
    } catch (err) {
      this.logger.warn(`Dispute org resolution failed: ${String(err)}`);
    }
    if (!organizationId) {
      // L'annulation d'org est tolérée (spec 11 : l'org émettrice devient
      // optionnelle) mais sans org on ne peut pas attribuer le message :
      // on journalise plutôt que d'envoyer à un destinataire arbitraire.
      this.logger.warn(
        `PAYMENT_DISPUTED ${disputeId}: no managing organization resolved`,
      );
      return;
    }
    const admins = await this.prisma.organizationMember.findMany({
      where: {
        organizationId,
        status: MemberStatus.ACTIVE,
        role: { in: ['OWNER', 'ADMIN'] },
      },
      select: { userId: true },
    });
    for (const { userId } of admins) {
      await this.notifications.send({
        userId,
        type: 'DISPUTE_OPENED',
        payload: { paymentId, disputeId, reason: reason ?? null },
      });
    }
  }

  /** Spec 11 matrice — REFUND_DONE → payeur. */
  @OnEvent(DOMAIN_EVENTS.PAYMENT_REFUNDED)
  async handleRefunded(
    event: DomainEvent<{
      paymentId: string;
      refundId: string;
      amount: string;
      currency: string;
    }>,
  ): Promise<void> {
    const { paymentId, refundId, amount, currency } = event.payload;
    if (!paymentId) {
      this.logger.warn('PAYMENT_REFUNDED event missing paymentId');
      return;
    }
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: { userId: true },
    });
    if (!payment) {
      this.logger.warn(`PAYMENT_REFUNDED ${paymentId}: payment not found`);
      return;
    }
    await this.notifications.send({
      userId: payment.userId,
      type: 'REFUND_DONE',
      payload: { paymentId, refundId: refundId ?? null, amount, currency },
    });
  }

  /**
   * Résout l'org de gestion d'un paiement : cible séjour explicite
   * (bookingId) sinon allocation loyer (rentSchedule → lease → property).
   */
  private async resolveOrgForPayment(
    paymentId: string,
  ): Promise<string | null> {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        bookingId: true,
        allocations: {
          take: 1,
          select: {
            rentSchedule: {
              select: {
                lease: {
                  select: { property: { select: { organizationId: true } } },
                },
              },
            },
          },
        },
      },
    });
    if (!payment) return null;
    if (payment.bookingId) {
      const booking = await this.prisma.booking.findUnique({
        where: { id: payment.bookingId },
        select: { property: { select: { organizationId: true } } },
      });
      if (booking?.property?.organizationId) {
        return booking.property.organizationId;
      }
    }
    return (
      payment.allocations?.[0]?.rentSchedule?.lease?.property?.organizationId ??
      null
    );
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
