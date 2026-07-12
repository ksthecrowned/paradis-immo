import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';
import { ReceiptService } from '../../payments/receipts/receipt.service';

/**
 * Consumes `PAYMENT_VALIDATED` and notifies the tenant that their
 * receipt is ready.
 */
@Injectable()
export class PaymentValidatedProcessor {
  private readonly logger = new Logger(PaymentValidatedProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly receipts: ReceiptService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.PAYMENT_VALIDATED)
  async handle(
    event: DomainEvent<{ paymentId: string; userId: string }>,
  ): Promise<void> {
    const { paymentId } = event.payload;
    if (!paymentId) {
      this.logger.warn('PAYMENT_VALIDATED event missing paymentId');
      return;
    }
    await this.handlePaymentValidated(paymentId, event.payload.userId);
  }

  /**
   * Public for direct invocation from tests.
   */
  async handlePaymentValidated(
    paymentId: string,
    _userId: string,
  ): Promise<{ sent: boolean; reason?: string }> {
    void _userId;
    const receipt = await this.receipts.generateForPayment(paymentId);
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      select: {
        userId: true,
        allocations: {
          take: 1,
          select: {
            rentSchedule: {
              select: {
                lease: {
                  select: {
                    property: { select: { organizationId: true } },
                  },
                },
              },
            },
          },
        },
      },
    });
    if (!payment) {
      this.logger.warn(`Payment ${paymentId} not found for notification`);
      return { sent: false, reason: 'PAYMENT_NOT_FOUND' };
    }
    const organizationId =
      payment.allocations[0]?.rentSchedule?.lease?.property?.organizationId;
    const result = await this.notifications.send({
      userId: payment.userId,
      organizationId,
      type: 'PAYMENT_RECEIPT_READY',
      payload: {
        paymentId,
        receiptUrl: receipt.url,
        receiptNumber: receipt.number,
      },
    });
    this.logger.log(
      `Notified user ${payment.userId} about receipt ${receipt.number} (status=${result.status})`,
    );
    return { sent: result.status === 'SENT' };
  }
}
