// Domain events emitted across the Paradis Immo platform.
// Each event has a dedicated BullMQ queue named after the event name.

export const DOMAIN_EVENTS = {
  LEASE_CREATED: 'lease.created',
  PAYMENT_VALIDATED: 'payment.validated',
  PAYMENT_INITIATED: 'payment.initiated',
  MANDATE_ACTION_PENDING: 'mandate.action.pending',
  VISIT_BOOKING_CONFIRMED: 'visit.booking.confirmed',
  MAINTENANCE_OPENED: 'maintenance.opened',
  RENT_DUE_SOON: 'rent.due.soon',
  RENT_OVERDUE: 'rent.overdue',
} as const;

export type DomainEventName = (typeof DOMAIN_EVENTS)[keyof typeof DOMAIN_EVENTS];

export interface DomainEvent<T = unknown> {
  name: DomainEventName;
  payload: T;
  emittedAt: string;
}

export type EventPayloadOf<E extends DomainEventName> = E extends
  | typeof DOMAIN_EVENTS.PAYMENT_VALIDATED
  | typeof DOMAIN_EVENTS.PAYMENT_INITIATED
  ? { paymentId: string; userId: string; amount: string; currency: string }
  : E extends typeof DOMAIN_EVENTS.LEASE_CREATED
    ? { leaseId: string; propertyId: string; tenantId: string }
    : E extends typeof DOMAIN_EVENTS.MANDATE_ACTION_PENDING
      ? { approvalId: string; mandateId: string; actionType: string }
      : E extends typeof DOMAIN_EVENTS.VISIT_BOOKING_CONFIRMED
        ? { bookingId: string; slotId: string; userId: string }
        : E extends typeof DOMAIN_EVENTS.MAINTENANCE_OPENED
          ? { ticketId: string; propertyId: string; priority: string }
          : E extends typeof DOMAIN_EVENTS.RENT_DUE_SOON
            ? { rentScheduleId: string; dueDate: string }
            : E extends typeof DOMAIN_EVENTS.RENT_OVERDUE
              ? { rentScheduleId: string; daysOverdue: number }
              : Record<string, unknown>;