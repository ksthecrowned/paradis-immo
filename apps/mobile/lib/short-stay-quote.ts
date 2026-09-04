import type { Property } from '@/types/property';

export type ShortStayQuote = {
  nights: number;
  nightlyAmount: number;
  totalAmount: number;
  totalLabel: string;
  minNights: number;
  maxNights: number | null;
  /** null when dates/nights are valid for this property. */
  error: string | null;
};

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

/** Calendar nights: end − start in whole days (same as API bookings). */
export function nightsBetween(startIso: string, endIso: string): number {
  const start = Date.parse(`${startIso.slice(0, 10)}T00:00:00`);
  const end = Date.parse(`${endIso.slice(0, 10)}T00:00:00`);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) {
    return 0;
  }
  return Math.round((end - start) / (24 * 60 * 60 * 1000));
}

export function quoteShortStay(
  property: Pick<Property, 'priceAmount' | 'minNights' | 'maxNights'>,
  startIso: string,
  endIso: string,
): ShortStayQuote {
  const nights = nightsBetween(startIso, endIso);
  const nightlyAmount = Number.isFinite(property.priceAmount)
    ? property.priceAmount
    : 0;
  const minNights = property.minNights ?? 1;
  const maxNights = property.maxNights ?? null;
  const totalAmount = nights * nightlyAmount;

  let error: string | null = null;
  if (nights <= 0) {
    error = 'Choisissez une arrivée et un départ';
  } else if (nights < minNights) {
    error = `Séjour trop court (minimum ${minNights} nuit${minNights > 1 ? 's' : ''})`;
  } else if (maxNights != null && nights > maxNights) {
    error = `Séjour trop long (maximum ${maxNights} nuit${maxNights > 1 ? 's' : ''})`;
  }

  return {
    nights,
    nightlyAmount,
    totalAmount,
    totalLabel: formatFcfa(totalAmount),
    minNights,
    maxNights,
    error,
  };
}
