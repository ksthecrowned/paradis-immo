import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 04 — lease signature by OTP.
 *
 * `LeasesService.signLease` only records the signature; the other side has to
 * be told it is their turn:
 *   - the tenant signed → the property owner must sign too;
 *   - the landlord signed → the tenant must sign.
 *
 * When both have signed the lease is activated, which emits `LEASE_CREATED`;
 * `LeaseCreatedProcessor` already tells the tenant the lease is running, so
 * that case is skipped here.
 */
@Injectable()
export class LeaseSignedProcessor {
  private readonly logger = new Logger(LeaseSignedProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.LEASE_SIGNED)
  async handle(
    event: DomainEvent<{
      leaseId: string;
      propertyId: string;
      tenantId: string | null;
      party: 'TENANT' | 'LANDLORD';
      bothSigned: boolean;
    }>,
  ): Promise<void> {
    const { leaseId, tenantId, party, bothSigned } = event.payload;
    if (!leaseId || bothSigned) return;

    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { property: { select: { ownerId: true, title: true } } },
    });
    if (!lease) return;
    const propertyTitle = lease.property.title;

    try {
      if (party === 'TENANT') {
        if (!lease.property.ownerId || lease.property.ownerId === tenantId) {
          return;
        }
        await this.notifications.send({
          userId: lease.property.ownerId,
          type: 'LEASE_TENANT_SIGNED',
          payload: { leaseId, propertyTitle },
        });
        return;
      }
      if (tenantId) {
        await this.notifications.send({
          userId: tenantId,
          type: 'LEASE_LANDLORD_SIGNED',
          payload: { leaseId, propertyTitle },
        });
      }
    } catch (err) {
      this.logger.warn(
        `Failed to notify the co-signer of lease ${leaseId}: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
