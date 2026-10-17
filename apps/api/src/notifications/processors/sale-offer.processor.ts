import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 08 P1 — notifications de négociation :
 * - `SALE_OFFER_SUBMITTED` : nouvelle offre (ou contre-offre) → côté opposé.
 *   Une offre BUYER prévient le côté vente (owner) ; une contre-offre SELLER
 *   prévient l'acheteur.
 * - `SALE_OFFER_DECIDED` : décision → contrepartie (acheteur, et côté vente
 *   pour une acceptation).
 * - `SALE_OFFER_FORWARDED` : offre transmise au propriétaire par l'agent.
 */
@Injectable()
export class SaleOfferNotificationProcessor {
  private readonly logger = new Logger(SaleOfferNotificationProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.SALE_OFFER_SUBMITTED)
  async handleSubmitted(
    event: DomainEvent<{
      offerId: string;
      propertyId: string;
      buyerId: string;
      price: string;
    }>,
  ): Promise<void> {
    const { offerId, buyerId, price } = event.payload;
    if (!offerId) return;
    const offer = await this.prisma.saleOffer.findUnique({
      where: { id: offerId },
      select: {
        authorSide: true,
        property: { select: { ownerId: true, title: true } },
      },
    });
    if (!offer) {
      this.logger.warn(`SALE_OFFER_SUBMITTED ${offerId}: offer not found`);
      return;
    }

    if (offer.authorSide === 'BUYER') {
      if (!offer.property.ownerId) return;
      await this.notifications.send({
        userId: offer.property.ownerId,
        type: 'SALE_OFFER_RECEIVED',
        payload: {
          offerId,
          propertyTitle: offer.property.title,
          price,
          buyerUserId: buyerId,
        },
      });
    } else {
      await this.notifications.send({
        userId: buyerId,
        type: 'SALE_OFFER_RECEIVED',
        payload: { offerId, propertyTitle: offer.property.title, price },
      });
    }
  }

  @OnEvent(DOMAIN_EVENTS.SALE_OFFER_DECIDED)
  async handleDecided(
    event: DomainEvent<{
      offerId: string;
      propertyId: string;
      buyerId: string;
      price: string;
      decision?: string;
    }>,
  ): Promise<void> {
    const { offerId, buyerId, price, decision, propertyId } = event.payload;
    if (!offerId) return;
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId ?? '' },
      select: { ownerId: true, title: true },
    });
    if (!property) return;

    if (decision !== 'ACCEPTED' && decision !== 'REJECTED') return;

    await this.notifications.send({
      userId: buyerId,
      type: 'SALE_OFFER_DECIDED',
      payload: { offerId, decision, price, propertyTitle: property.title },
    });
    // Une acceptation notifie aussi le côté vente (les autres offres du
    // bien ont été rejetées automatiquement côté service).
    if (decision === 'ACCEPTED' && property.ownerId) {
      await this.notifications.send({
        userId: property.ownerId,
        type: 'SALE_OFFER_DECIDED',
        payload: { offerId, decision, price, propertyTitle: property.title },
      });
    }
  }

  @OnEvent(DOMAIN_EVENTS.SALE_OFFER_FORWARDED)
  async handleForwarded(
    event: DomainEvent<{
      offerId: string;
      propertyId: string;
      buyerId: string;
      price: string;
    }>,
  ): Promise<void> {
    const { offerId, price, propertyId } = event.payload;
    if (!offerId) return;
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId ?? '' },
      select: { ownerId: true, title: true },
    });
    if (!property?.ownerId) return;
    await this.notifications.send({
      userId: property.ownerId,
      type: 'SALE_OFFER_FORWARDED',
      payload: { offerId, price, propertyTitle: property.title },
    });
  }
}
