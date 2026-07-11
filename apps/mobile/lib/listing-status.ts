import type { Property, PropertyMode } from '@/types/property';

export type ListingStatus =
  | 'AVAILABLE'
  | 'SOLD'
  | 'UNDER_OFFER'
  | 'OCCUPIED'
  | 'AVAILABLE_SOON';

const BLOCKED: ReadonlySet<ListingStatus> = new Set([
  'SOLD',
  'UNDER_OFFER',
  'OCCUPIED',
]);

export function isConversionBlocked(
  p: Pick<Property, 'listingStatus'>,
): boolean {
  return BLOCKED.has(p.listingStatus);
}

export function isGrayscaleCard(p: Pick<Property, 'listingStatus'>): boolean {
  return isConversionBlocked(p);
}

export function passesAvailableOnlyFilter(
  p: Pick<Property, 'listingStatus' | 'mode'>,
): boolean {
  if (p.mode === 'RENT_SHORT') return true;
  return !BLOCKED.has(p.listingStatus);
}

export function daysUntilAvailable(
  availableFrom: string | null | undefined,
): number | null {
  if (!availableFrom) return null;
  const target = new Date(availableFrom);
  if (Number.isNaN(target.getTime())) return null;
  const now = new Date();
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
  );
  const startTarget = new Date(
    target.getFullYear(),
    target.getMonth(),
    target.getDate(),
  );
  const diffMs = startTarget.getTime() - startToday.getTime();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

export function listingStatusLabel(
  p: Pick<Property, 'listingStatus' | 'availableFrom'>,
): string | null {
  switch (p.listingStatus) {
    case 'AVAILABLE':
      return null;
    case 'UNDER_OFFER':
      return 'Sous offre';
    case 'OCCUPIED':
      return 'Occupé';
    case 'SOLD':
      return 'Vendu';
    case 'AVAILABLE_SOON': {
      const days = daysUntilAvailable(p.availableFrom);
      if (days == null) return 'Bientôt disponible';
      return `Bientôt · J-${days}`;
    }
    default:
      return null;
  }
}

function marketableRank(
  p: Pick<Property, 'listingStatus' | 'mode'>,
): number {
  if (p.mode === 'RENT_SHORT') return 0;
  if (p.listingStatus === 'AVAILABLE' || p.listingStatus === 'AVAILABLE_SOON') {
    return 0;
  }
  return 1;
}

export function sortMarketableFirst<
  T extends Pick<Property, 'listingStatus' | 'mode'>,
>(items: T[]): T[] {
  return [...items]
    .map((item, index) => ({ item, index, rank: marketableRank(item) }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((row) => row.item);
}

/** @deprecated Prefer passesAvailableOnlyFilter */
export function isPropertyAvailable(
  property: Pick<Property, 'listingStatus' | 'mode'>,
): boolean {
  return passesAvailableOnlyFilter(property);
}

export type { PropertyMode };
