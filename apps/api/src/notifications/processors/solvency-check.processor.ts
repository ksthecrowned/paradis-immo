import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

@Injectable()
export class SolvencyCheckProcessor {
  private readonly logger = new Logger(SolvencyCheckProcessor.name);

  constructor(private readonly notifications: NotificationsService) {}

  @OnEvent(DOMAIN_EVENTS.SOLVENCY_CHECK_REQUESTED)
  async handle(
    event: DomainEvent<{
      checkId: string;
      tenantUserId: string;
      requesterOrgId: string;
      organizationName: string;
    }>,
  ): Promise<void> {
    const { checkId, tenantUserId, organizationName } = event.payload;
    if (!checkId || !tenantUserId) {
      this.logger.warn('SOLVENCY_CHECK_REQUESTED missing ids');
      return;
    }
    await this.notifications.send({
      userId: tenantUserId,
      type: 'SOLVENCY_CHECK_REQUESTED',
      payload: {
        checkId,
        organizationName,
      },
    });
  }
}
