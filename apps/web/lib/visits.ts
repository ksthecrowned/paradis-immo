import { apiFetch } from '@/lib/api';

export interface PublicVisitBooking {
  id: string;
  slotId: string;
  propertyId: string;
  userId: string;
  status: string;
  agentId: string | null;
  paymentId: string | null;
  createdAt: string;
  // The /visits/managed endpoint joins VisitBooking with its slot and returns
  // the slot's start/end dates — typed here so calendar views can use them
  // without an extra fetch.
  slotStartAt?: string;
  slotEndAt?: string;
}

export interface PublicAssignableVisitAgent {
  userId: string;
  name: string | null;
}

export async function listManagedVisits(): Promise<PublicVisitBooking[]> {
  return apiFetch<PublicVisitBooking[]>('/visits/managed');
}

export async function listAssignableVisitAgents(
  propertyId: string,
): Promise<PublicAssignableVisitAgent[]> {
  return apiFetch<PublicAssignableVisitAgent[]>(
    `/visits/assignable-agents?propertyId=${encodeURIComponent(propertyId)}`,
  );
}

export async function assignVisitAgent(
  id: string,
  agentId: string | null,
): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>(`/visits/${id}/assign`, {
    method: 'PATCH',
    body: { agentId },
  });
}

export async function bookVisit(input: {
  slotId: string;
  propertyId: string;
  guestPhone?: string;
  guestName?: string;
}): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>('/visits', {
    method: 'POST',
    body: input,
  });
}

export async function confirmVisit(id: string): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>(`/visits/${id}/confirm`, {
    method: 'PATCH',
  });
}

export async function cancelVisit(id: string): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>(`/visits/${id}/cancel`, {
    method: 'PATCH',
  });
}

/** Spec 06 — passe une visite PENDING/CONFIRMED sur un autre créneau. */
export async function rescheduleVisit(
  id: string,
  newSlotId: string,
): Promise<PublicVisitBooking> {
  return apiFetch<PublicVisitBooking>(`/visits/${id}/reschedule`, {
    method: 'POST',
    body: { newSlotId },
  });
}

export function visitStatusLabel(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: 'Confirmée',
    PENDING: 'En attente',
    COMPLETED: 'Effectuée',
    COMPLETED_UNCONFIRMED: 'Effectuée (non confirmée)',
    NO_SHOW: 'Absence',
    CANCELLED: 'Annulée',
    EXPIRED: 'Expirée',
  };
  return map[status] ?? status;
}

export function visitStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'NO_SHOW') {
    return 'danger';
  }
  return 'neutral';
}
