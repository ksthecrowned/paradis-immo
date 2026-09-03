import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class BuyerPaymentProofProcessor {
  private readonly logger = new Logger(BuyerPaymentProofProcessor.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(DOMAIN_EVENTS.BUYER_PAYMENT_PROOF_REQUESTED)
  async handle(
    event: DomainEvent<{
      proofId: string;
      buyerUserId: string;
      saleAgreementId: string;
      requesterOrgId: string;
      organizationName: string;
    }>,
  ): Promise<void> {
    const { proofId, buyerUserId, saleAgreementId, organizationName } =
      event.payload;
    if (!proofId || !buyerUserId) {
      this.logger.warn('BUYER_PAYMENT_PROOF_REQUESTED missing ids');
      return;
    }
    await this.notifications.send({
      userId: buyerUserId,
      type: 'BUYER_PAYMENT_PROOF_REQUESTED',
      payload: {
        proofId,
        saleAgreementId,
        organizationName,
      },
    });
  }
}
