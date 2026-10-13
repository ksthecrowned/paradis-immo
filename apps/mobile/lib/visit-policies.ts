/**
 * Pure helpers for visit booking policies (spec 06): refund quote under the
 * 24h/2h rule, hold countdown label and seeker action gating. Kept free of
 * any runtime import so it can run in both bun tests and the app.
 */

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
  const refundPercent = hoursBefore >= 24 ? 100 : hoursBefore >= 2 ? 50 : 0;
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
  const remaining = new Date(booking.holdExpiresAt).getTime() - Date.now();
  if (remaining <= 0) return 'Hold expiré';
  const minutes = Math.floor(remaining / 60_000);
  const seconds = Math.floor((remaining % 60_000) / 1000);
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Over: the visit may still move or be cancelled by the seeker. */
export function canRescheduleBooking(booking: {
  status: string;
  slotStartAt?: string;
}): boolean {
  return (
    (booking.status === 'PENDING' || booking.status === 'CONFIRMED') &&
    (!booking.slotStartAt ||
      new Date(booking.slotStartAt).getTime() > Date.now())
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
    !booking.slotStartAt ||
    new Date(booking.slotStartAt).getTime() > Date.now()
  );
}
