import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { MemberStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 11 matrice (03) — MANDATE_ACCEPTED / MANDATE_DECLINED /
 * MANDATE_TERMINATED : les deux parties du mandat (propriétaire du bien et
 * gérance de l'agence) sont informées du changement d'état.
 */
@Injectable()
export class MandateLifecycleNotificationsProcessor {
  private readonly logger = new Logger(
    MandateLifecycleNotificationsProcessor.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.MANDATE_ACCEPTED)
  async onAccepted(
    event: DomainEvent<{
      mandateId: string;
      propertyId: string;
      organizationId: string;
    }>,
  ): Promise<void> {
    await this.notifyParties(event.payload, 'MANDATE_ACCEPTED');
  }

  @OnEvent(DOMAIN_EVENTS.MANDATE_DECLINED)
  async onDeclined(
    event: DomainEvent<{
      mandateId: string;
      propertyId: string;
      organizationId: string;
    }>,
  ): Promise<void> {
    await this.notifyParties(event.payload, 'MANDATE_DECLINED');
  }

  @OnEvent(DOMAIN_EVENTS.MANDATE_TERMINATED)
  async onTerminated(
    event: DomainEvent<{
      mandateId: string;
      propertyId: string;
      organizationId: string;
      effectiveAt: string;
      reason: string;
    }>,
  ): Promise<void> {
    await this.notifyParties(event.payload, 'MANDATE_TERMINATED');
  }

  /**
   * Destinataires : OWNER/ADMIN actifs de l'org du mandat + owner du bien
   * (compte utilisateur direct). Déduupliqué par identifiant utilisateur.
   */
  private async notifyParties(
    payload: { mandateId?: string; effectiveAt?: string; reason?: string },
    type: 'MANDATE_ACCEPTED' | 'MANDATE_DECLINED' | 'MANDATE_TERMINATED',
  ): Promise<void> {
    const { mandateId } = payload;
    if (!mandateId) {
      this.logger.warn(`${type} event missing mandateId`);
      return;
    }
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      select: {
        property: { select: { ownerId: true } },
        organization: {
          select: {
            members: {
              where: {
                status: MemberStatus.ACTIVE,
                role: { in: ['OWNER', 'ADMIN'] },
              },
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!mandate) {
      this.logger.warn(`Mandate ${mandateId} not found for ${type}`);
      return;
    }
    const targets = new Set<string>();
    for (const { userId } of mandate.organization?.members ?? []) {
      targets.add(userId);
    }
    if (mandate.property?.ownerId) targets.add(mandate.property.ownerId);
    for (const userId of targets) {
      await this.notifications.send({
        userId,
        type,
        payload: { ...payload },
      });
    }
  }
}
