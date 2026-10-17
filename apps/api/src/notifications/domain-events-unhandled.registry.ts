import { DOMAIN_EVENTS } from '../events/event.types';

/**
 * Spec 11 — événements de `DOMAIN_EVENTS` sans listener `@OnEvent` volontairement
 * documentés. Tout nouvel événement doit soit gagner un handler, soit être
 * ajouté ici avec une raison. Le test `domain-events-coverage.spec.ts` échoue
 * sinon.
 *
 * Les entrées « cron » produisent déjà des notifications via un processor
 * planifié, mais n'écoutent pas l'événement domaine via `@OnEvent`.
 */
export const INTENTIONALLY_UNHANDLED_DOMAIN_EVENTS = [
  // Séjours (spec 07) — seul BOOKING_HELD a un handler aujourd'hui.
  'BOOKING_HOLD_EXPIRED',
  'BOOKING_REQUESTED',
  'BOOKING_CANCELLED',
  'BOOKING_ACCEPTED',
  'BOOKING_DECLINED',
  'BOOKING_EXPIRED',
  'BOOKING_CONFIRMED',
  'BOOKING_CHECKED_IN',
  'BOOKING_CHECKED_OUT',
  'BOOKING_COMPLETED',
  'BOOKING_DAMAGE_REPORTED',
  'BOOKING_PICKED',
  // Avenants / renouvellement / indexation (spec 04 P2).
  'AMENDMENT_CREATED',
  'AMENDMENT_SIGNED',
  'AMENDMENT_APPLIED',
  'LEASE_RENEWED',
  'RENT_INDEXATION_PROPOSED',
  // Recouvrement (spec 04 P2) — émis, pas encore de notif dédiée.
  'LEASE_REMINDER_SENT',
  'LATE_FEE_APPLIED',
  'LATE_FEE_WAIVED',
  'FORMAL_NOTICE_SENT',
  // Modération messagerie (spec 10).
  'MESSAGE_REPORTED',
  // Mandats — document ADR-0001 ; MANDATE_EXPIRING notifié via cron.
  'MANDATE_EXPIRING',
  'MANDATE_DOCUMENT_DEPOSITED',
  'MANDATE_DOCUMENT_REVIEWED',
  // Loyers — cron RentReminderProcessor (pas d'@OnEvent sur ces noms).
  'RENT_DUE_SOON',
  'RENT_OVERDUE',
  /** Événement interne du scheduler ; non émis par les modules métier. */
  'RENT_REMINDER_DAILY',
] as const satisfies ReadonlyArray<keyof typeof DOMAIN_EVENTS>;

export type IntentionallyUnhandledDomainEvent =
  (typeof INTENTIONALLY_UNHANDLED_DOMAIN_EVENTS)[number];
