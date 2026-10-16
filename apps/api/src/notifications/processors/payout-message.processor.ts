import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MemberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 05/10/03/11 — notifie les acteurs des événements financiers et de
 * messagerie émis sans destinataire :
 *
 * - `PAYOUT_PAID` / `PAYOUT_FAILED` (05) : gérant de l'org du well funding ;
 * - `MESSAGE_CREATED` (10) : message in-app → push au destinataire ;
 * - `MANDATE_PROPOSED` (03) : le propriétaire voit la proposition de mandat.
 */
@Injectable()
export class PayoutMessagingNotificationsProcessor {
  private readonly logger = new Logger(
    PayoutMessagingNotificationsProcessor.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.PAYOUT_PAID)
  async onPayoutPaid(
    event: DomainEvent<{
      payoutId: string;
      organizationId: string;
      amount: string;
      currency: string;
    }>,
  ): Promise<void> {
    const { payoutId, organizationId, amount, currency } = event.payload;
    if (!payoutId || !organizationId) return;
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
        type: 'PAYOUT_PAID',
        payload: { payoutId, amount, currency },
      });
    }
  }

  @OnEvent(DOMAIN_EVENTS.PAYOUT_FAILED)
  async onPayoutFailed(
    event: DomainEvent<{
      payoutId: string;
      organizationId: string;
      amount: string;
      currency: string;
      reason: string | null;
    }>,
  ): Promise<void> {
    const { payoutId, organizationId, amount, currency, reason } =
      event.payload;
    if (!payoutId || !organizationId) return;
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
        type: 'PAYOUT_FAILED',
        payload: { payoutId, amount, currency, reason: reason ?? null },
      });
    }
  }

  @OnEvent(DOMAIN_EVENTS.MESSAGE_CREATED)
  async onMessageCreated(
    event: DomainEvent<{
      conversationId: string;
      messageId: string;
      senderId: string;
      clientUserId: string | null;
      organizationId: string | null;
    }>,
  ): Promise<void> {
    const {
      conversationId,
      messageId,
      senderId,
      clientUserId,
      organizationId,
    } = event.payload;
    if (!messageId || !conversationId || !senderId) return;
    // Récipient = l'autre partie de la conversation :
    // - conversation client (clientUserId) → l'autre côté est l'org du bien ;
    // - conversation organisation → l'autre côté est le client.
    if (clientUserId && organizationId) {
      // Prévenir les 2 admins de l'organisation pour l'instant.
      const conv = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { propertyId: true },
      });
      const admins = conv?.propertyId
        ? await this.prisma.organizationMember.findMany({
            where: {
              organization: { properties: { some: { id: conv.propertyId } } },
              status: MemberStatus.ACTIVE,
              role: { in: ['OWNER', 'ADMIN'] },
            },
            select: { userId: true },
          })
        : [];
      for (const { userId } of admins) {
        if (userId === senderId) continue;
        await this.notifications.send({
          userId,
          type: 'MESSAGE_RECEIVED',
          payload: { conversationId, messageId },
        });
      }
      return;
    }
    // Sinon, si c'est une conversation org→client.
    if (clientUserId && !organizationId) {
      if (clientUserId === senderId) return;
      await this.notifications.send({
        userId: clientUserId,
        type: 'MESSAGE_RECEIVED',
        payload: { conversationId, messageId },
      });
    }
  }

  @OnEvent(DOMAIN_EVENTS.MANDATE_PROPOSED)
  async onMandateProposed(
    event: DomainEvent<{
      mandateId: string;
      propertyId: string;
      organizationId: string;
    }>,
  ): Promise<void> {
    const { mandateId, propertyId } = event.payload;
    if (!mandateId || !propertyId) return;
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true },
    });
    if (!property) return;
    await this.notifications.send({
      userId: property.ownerId,
      type: 'MANDATE_PROPOSED',
      payload: { mandateId, propertyId },
    });
  }
}
