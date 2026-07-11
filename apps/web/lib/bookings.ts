import { apiFetch } from '@/lib/api';

export interface PublicBooking {
  id: string;
  propertyId: string;
  userId: string;
  startDate: string;
  endDate: string;
  totalPrice: string;
  currency: string;
  status: string;
  createdAt: string;
}

export async function listManagedBookings(): Promise<PublicBooking[]> {
  return apiFetch<PublicBooking[]>('/bookings/managed');
}

export async function cancelBooking(id: string): Promise<PublicBooking> {
  return apiFetch<PublicBooking>(`/bookings/${id}/cancel`, {
    method: 'PATCH',
  });
}

export function bookingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'En attente',
    CONFIRMED: 'Confirmée',
    CANCELLED: 'Annulée',
    COMPLETED: 'Terminée',
  };
  return map[status] ?? status;
}

export function bookingStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED' || status === 'COMPLETED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}
