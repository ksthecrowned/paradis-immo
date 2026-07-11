import {
  assertListingStatusForMode,
  resolvePublicListing,
} from './listing-status';

describe('resolvePublicListing', () => {
  it('coerces RENT_SHORT to AVAILABLE', () => {
    expect(
      resolvePublicListing({
        mode: 'RENT_SHORT',
        listingStatus: 'OCCUPIED',
        availableFrom: null,
        activeLeaseEndDate: null,
      }),
    ).toEqual({ listingStatus: 'AVAILABLE', availableFrom: null });
  });

  it('uses lease end when AVAILABLE_SOON and no manual date', () => {
    const end = new Date('2026-08-01T00:00:00.000Z');
    expect(
      resolvePublicListing({
        mode: 'RENT_LONG',
        listingStatus: 'AVAILABLE_SOON',
        availableFrom: null,
        activeLeaseEndDate: end,
      }).availableFrom,
    ).toBe(end.toISOString());
  });

  it('coerces AVAILABLE_SOON without date to OCCUPIED', () => {
    expect(
      resolvePublicListing({
        mode: 'RENT_LONG',
        listingStatus: 'AVAILABLE_SOON',
        availableFrom: null,
        activeLeaseEndDate: null,
      }).listingStatus,
    ).toBe('OCCUPIED');
  });
});

describe('assertListingStatusForMode', () => {
  it('rejects UNDER_OFFER on RENT_LONG', () => {
    expect(() =>
      assertListingStatusForMode('RENT_LONG', 'UNDER_OFFER'),
    ).toThrow();
  });

  it('allows UNDER_OFFER on SALE', () => {
    expect(() =>
      assertListingStatusForMode('SALE', 'UNDER_OFFER'),
    ).not.toThrow();
  });
});
