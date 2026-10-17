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
  /** Spec 07 — hold 15 min (PENDING_PAYMENT) : compte à rebours checkout. */
  holdExpiresAt?: string | null;
  /** Devis server-side figé (facultatif si absent côté listing). */
  quote?: {
    total: string;
    nights: number;
  } | null;
  refundAmount?: string | null;
  refundPercent?: number;
  createdAt: string;
}

export type BookingCancellationPreview = {
  refundPercent: number;
  refundAmount: string;
  currency: string;
};

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
  return apiFetch<PublicBooking>(`/bookings/${id}/cancel`, { method: 'POST' });
}

export async function getBookingCancellationPreview(
  id: string,
): Promise<BookingCancellationPreview> {
  return apiFetch<BookingCancellationPreview>(
    `/bookings/${id}/cancellation-preview`,
  );
}

export function canCancelBooking(status: string): boolean {
  return ['PENDING_PAYMENT', 'REQUESTED', 'ACCEPTED', 'CONFIRMED'].includes(
    status,
  );
}

export function bookingStatusLabel(status: string): string {
  const map: Record<string, string> = {
    REQUESTED: 'Demande envoyée',
    ACCEPTED: 'Acceptée · paiement requis',
    PENDING_PAYMENT: 'Paiement en attente',
    CONFIRMED: 'Confirmée',
    CHECKED_IN: 'En cours',
    CHECKED_OUT: 'Départ effectué',
    COMPLETED: 'Terminée',
    CANCELLED_BY_GUEST: 'Annulée par vous',
    CANCELLED_BY_HOST: 'Annulée par l’hôte',
    DECLINED: 'Refusée',
    EXPIRED: 'Expirée',
  };
  return map[status] ?? status;
}

export function bookingStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(status)) return 'success';
  if (['REQUESTED', 'ACCEPTED', 'PENDING_PAYMENT'].includes(status)) return 'warning';
  if (status.startsWith('CANCELLED') || status === 'DECLINED' || status === 'EXPIRED') return 'danger';
  return 'neutral';
}
