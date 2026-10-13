import { apiFetch } from '@/lib/api';

// Politiques pures (remboursement 24h/2h, hold, gating) — réexportées pour
// les appelants existants ; sources de vérité dans `lib/visit-policies.ts`.
export type { VisitRefundQuote } from './visit-policies';
export {
  canCancelBooking,
  canRescheduleBooking,
  visitHoldCountdown,
  visitRefundQuote,
} from './visit-policies';

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
