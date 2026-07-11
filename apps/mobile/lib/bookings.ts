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

export interface AvailabilityWindow {
  startDate: string;
  endDate: string;
  reason: string;
  refId: string | null;
}

export async function listAvailability(
  propertyId: string,
  from?: Date,
  to?: Date,
): Promise<AvailabilityWindow[]> {
  const params = new URLSearchParams();
  if (from) params.set('from', from.toISOString());
  if (to) params.set('to', to.toISOString());
  const qs = params.toString();
  return apiFetch<AvailabilityWindow[]>(
    `/properties/${propertyId}/availability${qs ? `?${qs}` : ''}`,
    { anonymous: true },
  );
}

export async function createBooking(input: {
  propertyId: string;
  startDate: Date;
  endDate: Date;
}): Promise<PublicBooking> {
  return apiFetch<PublicBooking>('/bookings', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      startDate: input.startDate.toISOString(),
      endDate: input.endDate.toISOString(),
    },
  });
}

export async function listMyBookings(): Promise<PublicBooking[]> {
  return apiFetch<PublicBooking[]>('/bookings/my');
}

export async function cancelBooking(id: string): Promise<PublicBooking> {
  return apiFetch<PublicBooking>(`/bookings/${id}/cancel`, { method: 'PATCH' });
}

export function bookingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: 'Confirmée',
    PENDING: 'En attente',
    CANCELLED: 'Annulée',
  };
  return map[status] ?? status;
}

export function bookingStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}
