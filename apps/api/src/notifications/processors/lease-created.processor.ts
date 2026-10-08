import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 04 — `LEASE_CREATED` notifies the tenant (acceptance criterion 11).
 *
 * Leases created with only an `invitedPhone` have no tenant account yet, so
 * they are skipped here; those are invited over WhatsApp at creation time by
 * `LeasesService`.
 */
@Injectable()
export class LeaseCreatedProcessor {
  private readonly logger = new Logger(LeaseCreatedProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.LEASE_CREATED)
  async handle(
    event: DomainEvent<{
      leaseId: string;
      propertyId: string;
      tenantId: string | null;
    }>,
  ): Promise<void> {
    const { leaseId, tenantId } = event.payload;
    if (!leaseId) return;
    if (!tenantId) {
      this.logger.log(
        `LEASE_CREATED ${leaseId}: tenant not linked yet, in-app notification skipped`,
      );
      return;
    }
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { property: { select: { title: true } } },
    });
    await this.notifications.send({
      userId: tenantId,
      type: 'LEASE_STARTED',
      payload: { leaseId, propertyTitle: lease?.property.title ?? null },
    });
  }
}