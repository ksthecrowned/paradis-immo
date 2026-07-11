import { apiFetch } from '@/lib/api';

export interface PublicVisitBooking {
  id: string;
  slotId: string;
  propertyId: string;
  userId: string;
  status: string;
  paymentId: string | null;
  createdAt: string;
}

export async function listManagedVisits(): Promise<PublicVisitBooking[]> {
  return apiFetch<PublicVisitBooking[]>('/visits/managed');
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
