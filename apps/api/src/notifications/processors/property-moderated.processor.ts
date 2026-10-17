import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 15 A2 — une annonce modérée (PAUSED pour motif, REJECTED…) notifie
 * le propriétaire avec le motif (criter 12 : « notifié LISTING_MODERATED
 * contenant ce motif »).
 */
@Injectable()
export class PropertyModeratedProcessor {
  private readonly logger = new Logger(PropertyModeratedProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.PROPERTY_MODERATED)
  async handle(
    event: DomainEvent<{
      propertyId: string;
      ownerId: string | null;
      status: string;
      reason: string | null;
      title: string;
    }>,
  ): Promise<void> {
    const { propertyId, ownerId, status, reason, title } = event.payload;
    if (!propertyId || !ownerId) {
      this.logger.warn('PROPERTY_MODERATED event missing ids');
      return;
    }
    await this.notifications.send({
      userId: ownerId,
      type: 'LISTING_MODERATED',
      payload: {
        propertyId,
        propertyTitle: title,
        status,
        reason,
      },
    });
  }
}
