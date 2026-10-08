import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 03 — every `MANDATE_ACTION_PENDING` produces a notification to the
 * property owner (acceptance criterion).
 */
@Injectable()
export class MandateActionProcessor {
  private readonly logger = new Logger(MandateActionProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.MANDATE_ACTION_PENDING)
  async handle(
    event: DomainEvent<{ approvalId: string; mandateId: string; actionType: string }>,
  ): Promise<void> {
    const { approvalId, mandateId, actionType } = event.payload;
    if (!approvalId || !mandateId) {
      this.logger.warn('MANDATE_ACTION_PENDING event missing ids');
      return;
    }
    await this.handlePending(approvalId, mandateId, actionType);
  }

  @OnEvent(DOMAIN_EVENTS.MANDATE_AGENT_ASSIGNED)
  async handleAssigned(
    event: DomainEvent<{ mandateId: string; agentUserId: string }>,
  ): Promise<void> {
    const { mandateId, agentUserId } = event.payload;
    if (!mandateId || !agentUserId) return;
    await this.notifications.send({
      userId: agentUserId,
      type: 'MANDATE_ASSIGNED',
      payload: { mandateId },
    });
  }

  /** Public for direct invocation from tests. */
  async handlePending(
    approvalId: string,
    mandateId: string,
    actionType: string,
  ): Promise<{ sent: boolean; reason?: string }> {
    const mandate = await this.prisma.mandate.findUnique({
      where: { id: mandateId },
      select: {
        property: { select: { ownerId: true, organizationId: true } },
      },
    });
    if (!mandate) {
      this.logger.warn(`Mandate ${mandateId} not found for notification`);
      return { sent: false, reason: 'MANDATE_NOT_FOUND' };
    }
    const result = await this.notifications.send({
      userId: mandate.property.ownerId,
      type: 'MANDATE_ACTION_PENDING',
      payload: { approvalId, mandateId, actionType },
    });
    this.logger.log(
      `Notified owner ${mandate.property.ownerId} of pending approval ${approvalId} (${actionType})`,
    );
    return { sent: result.status === 'SENT' };
  }
}
