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
  paymentId: string | null;
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

export function visitStatusLabel(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: 'Confirmée',
    PENDING: 'En attente',
    CANCELLED: 'Annulée',
  };
  return map[status] ?? status;
}

export function visitStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}
