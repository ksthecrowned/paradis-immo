import { BadRequestException } from '@nestjs/common';

export type ListingStatusValue =
  | 'AVAILABLE'
  | 'SOLD'
  | 'UNDER_OFFER'
  | 'OCCUPIED'
  | 'AVAILABLE_SOON';

const SALE_ALLOWED: ReadonlySet<ListingStatusValue> = new Set([
  'AVAILABLE',
  'UNDER_OFFER',
  'SOLD',
]);

const RENT_LONG_ALLOWED: ReadonlySet<ListingStatusValue> = new Set([
  'AVAILABLE',
  'OCCUPIED',
  'AVAILABLE_SOON',
]);

export function assertListingStatusForMode(
  mode: string,
  status: ListingStatusValue,
): void {
  if (mode === 'RENT_SHORT') {
    if (status !== 'AVAILABLE') {
      throw new BadRequestException({
        code: 'INVALID_LISTING_STATUS',
        message:
          'RENT_SHORT listings must use listingStatus AVAILABLE (calendar owns availability)',
      });
    }
    return;
  }

  if (mode === 'SALE') {
    if (!SALE_ALLOWED.has(status)) {
      throw new BadRequestException({
        code: 'INVALID_LISTING_STATUS',
        message: `SALE listings may only use AVAILABLE, UNDER_OFFER, or SOLD (got ${status})`,
      });
    }
    return;
  }

  if (mode === 'RENT_LONG') {
    if (!RENT_LONG_ALLOWED.has(status)) {
      throw new BadRequestException({
        code: 'INVALID_LISTING_STATUS',
        message: `RENT_LONG listings may only use AVAILABLE, OCCUPIED, or AVAILABLE_SOON (got ${status})`,
      });
    }
    return;
  }

  throw new BadRequestException({
    code: 'INVALID_PROPERTY_MODE',
    message: `Unknown property mode: ${mode}`,
  });
}

/** Coerce write payload for RENT_SHORT always to AVAILABLE. */
export function coerceListingStatusForWrite(
  mode: string,
  status: ListingStatusValue | undefined,
): ListingStatusValue {
  if (mode === 'RENT_SHORT') return 'AVAILABLE';
  return status ?? 'AVAILABLE';
}

export function resolvePublicListing(input: {
  mode: string;
  listingStatus: ListingStatusValue;
  availableFrom: Date | null;
  activeLeaseEndDate: Date | null;
}): { listingStatus: ListingStatusValue; availableFrom: string | null } {
  if (input.mode === 'RENT_SHORT') {
    return { listingStatus: 'AVAILABLE', availableFrom: null };
  }

  if (input.listingStatus === 'AVAILABLE_SOON') {
    const date = input.availableFrom ?? input.activeLeaseEndDate;
    if (!date) {
      return { listingStatus: 'OCCUPIED', availableFrom: null };
    }
    return {
      listingStatus: 'AVAILABLE_SOON',
      availableFrom: date.toISOString(),
    };
  }

  return {
    listingStatus: input.listingStatus,
    availableFrom: null,
  };
}

export function isListingStatusValue(value: unknown): value is ListingStatusValue {
  return (
    value === 'AVAILABLE' ||
    value === 'SOLD' ||
    value === 'UNDER_OFFER' ||
    value === 'OCCUPIED' ||
    value === 'AVAILABLE_SOON'
  );
}
