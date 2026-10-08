import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../events/event.types';
import type { DomainEvent } from '../events/event.types';

/**
 * Spec 04 — candidature lifecycle notifications.
 *
 * The service emits these events; without this listener the candidate would
 * never learn that their application was accepted, rejected (possibly
 * auto-rejected when a sibling won) or withdrawn.
 */
@Injectable()
export class ApplicationNotificationsProcessor {
  private readonly logger = new Logger(ApplicationNotificationsProcessor.name);

  constructor(
    private readonly notifications: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.APPLICATION_SUBMITTED)
  async onSubmitted(
    event: DomainEvent<{
      applicationId: string;
      propertyId: string;
      applicantId: string;
      organizationId: string;
      propertyTitle: string;
    }>,
  ): Promise<void> {
    const { applicationId, applicantId, propertyTitle } = event.payload;
    await this.notifications.send({
      userId: applicantId,
      type: 'APPLICATION_SUBMITTED',
      payload: { applicationId, propertyTitle },
    });
  }

  @OnEvent(DOMAIN_EVENTS.APPLICATION_ACCEPTED)
  async onAccepted(
    event: DomainEvent<{
      applicationId: string;
      propertyId: string;
      applicantId: string;
      autoRejectedIds: string[];
    }>,
  ): Promise<void> {
    const { applicationId, applicantId, propertyId } = event.payload;
    await this.notifications.send({
      userId: applicantId,
      type: 'APPLICATION_ACCEPTED',
      payload: { applicationId, propertyTitle: await this.title(propertyId) },
    });
  }

  @OnEvent(DOMAIN_EVENTS.APPLICATION_REJECTED)
  async onRejected(
    event: DomainEvent<{
      applicationId: string;
      applicantId: string;
      rejectionMessage: string | null;
      auto: boolean;
    }>,
  ): Promise<void> {
    const { applicationId, applicantId, rejectionMessage } = event.payload;
    await this.notifications.send({
      userId: applicantId,
      type: 'APPLICATION_REJECTED',
      payload: {
        applicationId,
        ...(rejectionMessage ? { rejectionMessage } : {}),
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.APPLICATION_WITHDRAWN)
  async onWithdrawn(
    event: DomainEvent<{
      applicationId: string;
      propertyId: string;
      applicantId: string;
      organizationId: string;
    }>,
  ): Promise<void> {
    const { applicationId, applicantId, propertyId } = event.payload;
    await this.notifications.send({
      userId: applicantId,
      type: 'APPLICATION_WITHDRAWN',
      payload: { applicationId, propertyTitle: await this.title(propertyId) },
    });
  }

  /**
   * Listing title for the message. Cosmetic only: a lookup failure must not
   * swallow the notification, so it falls back to a short id.
   */
  private async title(propertyId: string): Promise<string> {
    try {
      const property = await this.prisma.property.findUnique({
        where: { id: propertyId },
        select: { title: true },
      });
      return property?.title ?? propertyId.slice(0, 8);
    } catch (error) {
      this.logger.warn(
        `Could not resolve title for property ${propertyId}: ${String(error)}`,
      );
      return propertyId.slice(0, 8);
    }
  }
}