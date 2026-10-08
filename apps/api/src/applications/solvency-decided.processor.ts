import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { DOMAIN_EVENTS } from '../events/event.types';
import type { DomainEvent } from '../events/event.types';
import { RentalApplicationsService } from './rental-applications.service';

/**
 * Spec 04 — a candidature-targeted solvency request answered by the
 * candidate sends the candidature back to `UNDER_REVIEW`, so the manager
 * picks it up again with the answer in hand.
 */
@Injectable()
export class SolvencyDecidedProcessor {
  private readonly logger = new Logger(SolvencyDecidedProcessor.name);

  constructor(private readonly applications: RentalApplicationsService) {}

  @OnEvent(DOMAIN_EVENTS.SOLVENCY_CHECK_DECIDED)
  async handle(
    event: DomainEvent<{
      checkId: string;
      tenantUserId: string;
      status: string;
      applicationId: string | null;
    }>,
  ): Promise<void> {
    const { applicationId } = event.payload;
    if (!applicationId) return; // tenant-targeted check, nothing to update
    await this.applications.onSolvencyDecided(applicationId);
  }
}