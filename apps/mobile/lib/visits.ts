import { apiFetch } from '@/lib/api';

export interface PublicVisitSlot {
  id: string;
  propertyId: string;
  startAt: string;
  endAt: string;
  status: string;
  source: string;
  createdAt: string;
}

export interface PublicVisitBooking {
  id: string;
  slotId: string;
  propertyId: string;
  userId: string;
  status: string;
  agentId?: string | null;
  paymentId: string | null;
  holdExpiresAt?: string | null;
  priceAmount?: string | null;
  currency?: string | null;
  createdAt: string;
  slotStartAt?: string;
  slotEndAt?: string;
}

export async function listVisitSlots(
  propertyId: string,
  from?: Date,
  to?: Date,
): Promise<PublicVisitSlot[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString());
  if (to) params.set('to', to.toISOString());
  const qs = params.toString();
  return apiFetch<PublicVisitSlot[]>(
    `/properties/${propertyId}/visit-slots${qs ? `?${qs}` : ''}`,
    { anonymous: true },
  );
}

export async function bookVisit(
  propertyId: string,
  slotId: string,
): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>('/visits', {
    method: 'POST',
    body: { propertyId, slotId },
  });
}

export async function listMyVisits(): Promise<PublicVisitBooking[]> {
  return apiFetch<PublicVisitBooking[]>('/visits/my');
}

export async function cancelVisit(id: string): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>(`/visits/${id}/cancel`, { method: 'PATCH' });
}

/** Spec 06 — reprogrammation d'une visite vers un autre créneau disponible. */
export async function rescheduleVisit(
  id: string,
  newSlotId: string,
): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>(`/visits/${id}/reschedule`, {
    method: 'POST',
    body: { newSlotId },
  });
}

export interface VisitRefundQuote {
  refundPercent: number;
  priceAmount: string | null;
  currency: string | null;
}

/** Spec 06/05 — quote de remboursement selon la politique 24h/2h. */
export function visitRefundQuote(booking: {
  status: string;
  slotStartAt?: string;
  priceAmount?: string | null;
  currency?: string | null;
  paymentId?: string | null;
}): VisitRefundQuote | null {
  if (
    !booking.slotStartAt ||
    (!booking.priceAmount && !booking.paymentId) ||
    booking.status === 'CANCELLED' ||
    booking.status === 'CANCELLED_BY_SEEKER' ||
    booking.status === 'CANCELLED_BY_AGENCY'
  ) {
    return null;
  }
  const hoursBefore =
    (new Date(booking.slotStartAt).getTime() - Date.now()) / 3_600_000;
  const refundPercent =
    hoursBefore >= 24 ? 100 : hoursBefore >= 2 ? 50 : 0;
  return {
    refundPercent,
    priceAmount: booking.priceAmount ?? null,
    currency: booking.currency ?? null,
  };
}

/** Libellé du compteur du hold 15 min (spec 06) — null si non payant/hold. */
export function visitHoldCountdown(booking: {
  status: string;
  holdExpiresAt?: string | null;
}): string | null {
  if (booking.status !== 'PENDING' || !booking.holdExpiresAt) return null;
  const remaining =
    new Date(booking.holdExpiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Hold expiré';
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Statuts finaux de l'enum API VisitBookingStatus (spec 06). Un statut
 * inconnu s'affiche brut plutôt que de masquer un enregistrement.
 */
const VISIT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'En attente',
  CONFIRMED: 'Confirmée',
  COMPLETED: 'Effectuée',
  COMPLETED_UNCONFIRMED: 'Effectuée (non confirmée)',
  NO_SHOW: 'Absence',
  CANCELLED_BY_SEEKER: 'Annulée',
  CANCELLED_BY_AGENCY: 'Annulée par l’agence',
  CANCELLED: 'Annulée',
  EXPIRED: 'Expirée',
};

export function visitStatusLabel(status: string): string {
  return VISIT_STATUS_LABELS[status] ?? status;
}

export function visitStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (
    status === 'CANCELLED' ||
    status === 'CANCELLED_BY_SEEKER' ||
    status === 'CANCELLED_BY_AGENCY' ||
    status === 'EXPIRED' ||
    status === 'NO_SHOW'
  ) {
    return 'danger';
  }
  if (status === 'COMPLETED' || status === 'COMPLETED_UNCONFIRMED') {
    return 'neutral';
  }
  return 'neutral';
}

/** Over: the visit may still move or be cancelled by the seeker. */
export function canRescheduleBooking(booking: {
  status: string;
  slotStartAt?: string;
}): boolean {
  return (
    (booking.status === 'PENDING' || booking.status === 'CONFIRMED') &&
    (!booking.slotStartAt || new Date(booking.slotStartAt).getTime() > Date.now())
  );
}

export function canCancelBooking(booking: {
  status: string;
  slotStartAt?: string;
}): boolean {
  if (
    booking.status === 'CANCELLED' ||
    booking.status === 'CANCELLED_BY_SEEKER' ||
    booking.status === 'CANCELLED_BY_AGENCY' ||
    booking.status === 'EXPIRED' ||
    booking.status === 'COMPLETED' ||
    booking.status === 'COMPLETED_UNCONFIRMED' ||
    booking.status === 'NO_SHOW'
  ) {
    return false;
  }
  return (
    !booking.slotStartAt || new Date(booking.slotStartAt).getTime() > Date.now()
  );
}
