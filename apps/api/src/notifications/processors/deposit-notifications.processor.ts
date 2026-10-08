import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 04 — deposit (caution) notifications.
 *
 *   - a deduction is proposed → the tenant is told and may contest 15 days;
 *   - the tenant contests → the property owner arbitrates;
 *   - the deposit is settled → the tenant sees the refund;
 *   - J+25 on a closing lease → the owner is reminded to refund in time.
 */
@Injectable()
export class DepositNotificationsProcessor {
  private readonly logger = new Logger(DepositNotificationsProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.DEPOSIT_DEDUCTION_PROPOSED)
  async onProposed(
    event: DomainEvent<{
      leaseId: string;
      deductionId: string;
      tenantId: string | null;
      label: string;
      amount: string;
    }>,
  ): Promise<void> {
    const { tenantId, deductionId, label, amount } = event.payload;
    if (!tenantId) return;
    await this.safeSend({
      userId: tenantId,
      type: 'DEPOSIT_DEDUCTION_PROPOSED',
      payload: {
        leaseId: event.payload.leaseId,
        deductionId,
        label,
        amount,
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.DEPOSIT_DEDUCTION_CONTESTED)
  async onContested(
    event: DomainEvent<{
      leaseId: string;
      deductionId: string;
      tenantId: string | null;
      label: string;
      amount: string;
      comment: string | null;
    }>,
  ): Promise<void> {
    const ownerId = await this.ownerOf(event.payload.leaseId);
    if (!ownerId) return;
    await this.safeSend({
      userId: ownerId,
      type: 'DEPOSIT_DEDUCTION_CONTESTED',
      payload: {
        leaseId: event.payload.leaseId,
        deductionId: event.payload.deductionId,
        label: event.payload.label,
        amount: event.payload.amount,
        comment: event.payload.comment,
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.DEPOSIT_SETTLED)
  async onSettled(
    event: DomainEvent<{
      leaseId: string;
      settlementId: string;
      tenantId: string | null;
      deducted: string;
      refundAmount: string;
      currency: string;
    }>,
  ): Promise<void> {
    const { tenantId, settlementId, deducted, refundAmount, currency } =
      event.payload;
    if (!tenantId) return;
    await this.safeSend({
      userId: tenantId,
      type: 'DEPOSIT_SETTLED',
      payload: {
        leaseId: event.payload.leaseId,
        settlementId,
        deducted,
        refundAmount,
        currency,
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.DEPOSIT_REFUND_DUE)
  async onRefundDue(
    event: DomainEvent<{
      leaseId: string;
      tenantId: string | null;
      refundDeadline: string;
      ownerId: string;
    }>,
  ): Promise<void> {
    const { leaseId, refundDeadline, ownerId } = event.payload;
    if (!ownerId) return;
    await this.safeSend({
      userId: ownerId,
      type: 'DEPOSIT_REFUND_DUE',
      payload: { leaseId, refundDeadline },
    });
  }

  private async ownerOf(leaseId: string): Promise<string | null> {
    const lease = await this.prisma.lease.findUnique({
      where: { id: leaseId },
      select: { property: { select: { ownerId: true } } },
    });
    return lease?.property.ownerId ?? null;
  }

  private async safeSend(input: {
    userId: string;
    type: string;
    payload: Record<string, unknown>;
  }): Promise<void> {
    try {
      await this.notifications.send(input);
    } catch (err) {
      this.logger.warn(
        `Deposit notification ${input.type} failed: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }
  }
}
