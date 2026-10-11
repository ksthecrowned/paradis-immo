import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { PrismaService } from '../../prisma/prisma.service';
import { DOMAIN_EVENTS } from '../../events/event.types';
import type { DomainEvent } from '../../events/event.types';
import { NotificationsService } from '../notifications.service';

/**
 * Spec 06/07/09/11 — notifie le voyageur/hôte des transitions de cycle de
 * vie émises sans destinataire :
 *
 * - `VISIT_BOOKING_HELD` (06) : compte à rebours du hold au visiteur ;
 * - `VISIT_BOOKING_CONFIRMED` (06) : confirmation au visiteur ;
 * - `BOOKING_HELD` (07) : hold 15 min au voyageur ;
 * - `MAINTENANCE_OPENED` (09) : accusé au propriétaire du bien ;
 * - `PAYMENT_INITIATED` (05) : rappel de fin de hold au payeur.
 */
@Injectable()
export class StayLifecycleNotificationsProcessor {
  private readonly logger = new Logger(
    StayLifecycleNotificationsProcessor.name,
  );

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  @OnEvent(DOMAIN_EVENTS.VISIT_BOOKING_HELD)
  async onVisitHeld(
    event: DomainEvent<{
      bookingId: string;
      slotId: string;
      userId: string;
      holdExpiresAt: string | null;
    }>,
  ): Promise<void> {
    const { bookingId, slotId, userId, holdExpiresAt } = event.payload;
    if (!bookingId || !userId) return;
    const property = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      select: { slot: { select: { property: { select: { title: true } } } } },
    });
    await this.notifications.send({
      userId,
      type: 'VISIT_HOLD',
      payload: {
        bookingId,
        slotId,
        propertyTitle: property?.slot.property.title ?? null,
        holdExpiresAt: holdExpiresAt ?? null,
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.VISIT_BOOKING_CONFIRMED)
  async onVisitConfirmed(
    event: DomainEvent<{ bookingId: string; slotId: string; userId: string }>,
  ): Promise<void> {
    const { bookingId, slotId, userId } = event.payload;
    if (!bookingId || !userId) return;
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      select: {
        agentId: true,
        slot: {
          select: { startAt: true, property: { select: { title: true } } },
        },
      },
    });
    const payload = {
      bookingId,
      slotId,
      propertyTitle: booking?.slot.property.title ?? null,
      startAt: booking?.slot.startAt.toISOString() ?? null,
    };
    await Promise.all([
      this.notifications.send({ userId, type: 'VISIT_CONFIRMED', payload }),
      ...(booking?.agentId && booking.agentId !== userId
        ? [
            this.notifications.send({
              userId: booking.agentId,
              type: 'VISIT_AGENT_CONFIRMED',
              payload,
            }),
          ]
        : []),
    ]);
  }

  @OnEvent(DOMAIN_EVENTS.VISIT_AGENT_ASSIGNED)
  async onVisitAgentAssigned(
    event: DomainEvent<{
      bookingId: string;
      agentId: string;
      assignedBy: string;
    }>,
  ): Promise<void> {
    const { bookingId, agentId, assignedBy } = event.payload;
    if (!bookingId || !agentId) return;
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      select: {
        slotId: true,
        userId: true,
        slot: {
          select: { startAt: true, property: { select: { title: true } } },
        },
      },
    });
    await this.notifications.send({
      userId: agentId,
      type: 'VISIT_AGENT_ASSIGNED',
      payload: {
        bookingId,
        slotId: booking?.slotId ?? null,
        visitorId: booking?.userId ?? null,
        propertyTitle: booking?.slot.property.title ?? null,
        startAt: booking?.slot.startAt.toISOString() ?? null,
        assignedBy,
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.VISIT_BOOKING_COMPLETED)
  async onVisitCompleted(
    event: DomainEvent<{
      bookingId: string;
      slotId: string;
      userId: string;
      propertyId: string;
    }>,
  ): Promise<void> {
    const { bookingId, slotId, userId, propertyId } = event.payload;
    if (!bookingId || !userId || !propertyId) return;
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true, title: true },
    });
    await Promise.all([
      this.notifications.send({
        userId,
        type: 'VISIT_COMPLETED',
        payload: { bookingId, slotId, propertyTitle: property?.title ?? null },
      }),
      ...(property && property.ownerId !== userId
        ? [
            this.notifications.send({
              userId: property.ownerId,
              type: 'VISIT_COMPLETED',
              payload: { bookingId, slotId, propertyTitle: property.title },
            }),
          ]
        : []),
    ]);
  }

  @OnEvent(DOMAIN_EVENTS.VISIT_BOOKING_NO_SHOW)
  async onVisitNoShow(
    event: DomainEvent<{
      bookingId: string;
      slotId: string;
      userId: string;
      propertyId: string;
    }>,
  ): Promise<void> {
    const { bookingId, slotId, propertyId } = event.payload;
    if (!bookingId || !propertyId) return;
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true, title: true },
    });
    if (!property) return;
    await this.notifications.send({
      userId: property.ownerId,
      type: 'VISIT_NO_SHOW',
      payload: { bookingId, slotId, propertyTitle: property.title },
    });
  }

  @OnEvent(DOMAIN_EVENTS.VISIT_BOOKING_UNCONFIRMED)
  async onVisitUnconfirmed(
    event: DomainEvent<{
      bookingId: string;
      slotId: string;
      userId: string;
      propertyId: string;
    }>,
  ): Promise<void> {
    const { bookingId, slotId, userId, propertyId } = event.payload;
    if (!bookingId || !userId || !propertyId) return;
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      select: {
        agentId: true,
        property: { select: { id: true, ownerId: true, title: true } },
      },
    });
    if (!booking || booking.property.id !== propertyId) return;
    const payload = {
      bookingId,
      slotId,
      visitorId: userId,
      propertyTitle: booking.property.title,
    };
    await Promise.all([
      this.notifications.send({
        userId: booking.property.ownerId,
        type: 'VISIT_UNCONFIRMED',
        payload,
      }),
      ...(booking.agentId && booking.agentId !== booking.property.ownerId
        ? [
            this.notifications.send({
              userId: booking.agentId,
              type: 'VISIT_AGENT_UNCONFIRMED',
              payload,
            }),
          ]
        : []),
    ]);
  }

  @OnEvent(DOMAIN_EVENTS.VISIT_REMINDER)
  async onVisitReminder(
    event: DomainEvent<{
      bookingId: string;
      slotId: string;
      userId: string;
      agentId: string | null;
      kind: 'J1' | 'H2';
    }>,
  ): Promise<void> {
    const { bookingId, slotId, userId, agentId, kind } = event.payload;
    if (!bookingId || !slotId || !userId) return;
    const booking = await this.prisma.visitBooking.findUnique({
      where: { id: bookingId },
      select: {
        slot: {
          select: { startAt: true, property: { select: { title: true } } },
        },
      },
    });
    const payload = {
      bookingId,
      slotId,
      propertyTitle: booking?.slot.property.title ?? null,
      startAt: booking?.slot.startAt.toISOString() ?? null,
    };
    await Promise.all([
      this.notifications.send({
        userId,
        type: kind === 'J1' ? 'VISIT_REMINDER_J1' : 'VISIT_REMINDER_H2',
        payload,
      }),
      ...(agentId && agentId !== userId
        ? [
            this.notifications.send({
              userId: agentId,
              type:
                kind === 'J1'
                  ? 'VISIT_AGENT_REMINDER_J1'
                  : 'VISIT_AGENT_REMINDER_H2',
              payload,
            }),
          ]
        : []),
    ]);
  }

  @OnEvent(DOMAIN_EVENTS.BOOKING_HELD)
  async onStayHeld(
    event: DomainEvent<{
      bookingId: string;
      userId: string;
      holdExpiresAt?: string;
    }>,
  ): Promise<void> {
    const { bookingId, userId, holdExpiresAt } = event.payload;
    if (!bookingId || !userId) return;
    await this.notifications.send({
      userId,
      type: 'STAY_HOLD',
      payload: {
        bookingId,
        holdExpiresAt: holdExpiresAt ?? null,
      },
    });
  }

  @OnEvent(DOMAIN_EVENTS.MAINTENANCE_OPENED)
  async onMaintenanceOpened(
    event: DomainEvent<{
      ticketId: string;
      propertyId: string;
      priority: string;
    }>,
  ): Promise<void> {
    const { ticketId, propertyId, priority } = event.payload;
    if (!ticketId || !propertyId) return;
    const property = await this.prisma.property.findUnique({
      where: { id: propertyId },
      select: { ownerId: true, title: true },
    });
    if (!property) return;
    await this.notifications.send({
      userId: property.ownerId,
      type: 'MAINTENANCE_OPENED',
      payload: { ticketId, propertyTitle: property.title, priority },
    });
  }

  @OnEvent(DOMAIN_EVENTS.PAYMENT_INITIATED)
  async onPaymentInitiated(
    event: DomainEvent<{
      paymentId: string;
      userId: string;
      amount: string;
      currency: string;
    }>,
  ): Promise<void> {
    const { paymentId, userId, amount, currency } = event.payload;
    if (!paymentId || !userId) return;
    await this.notifications.send({
      userId,
      type: 'PAYMENT_INITIATED',
      payload: { paymentId, amount, currency },
    });
  }

  /** Exposed for direct unit-test invocation. */
  async emitVisitHeld(payload: {
    bookingId: string;
    slotId: string;
    userId: string;
    holdExpiresAt: string | null;
  }): Promise<void> {
    this.logger.debug(`visit held ${payload.bookingId}`);
    return this.onVisitHeld({
      name: DOMAIN_EVENTS.VISIT_BOOKING_HELD,
      payload,
      emittedAt: new Date().toISOString(),
    });
  }
}
