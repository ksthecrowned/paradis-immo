import { describe, expect, test } from 'bun:test';
import {
  isGrayscaleCard,
  listingStatusLabel,
  passesAvailableOnlyFilter,
  sortMarketableFirst,
} from './listing-status';

const base = {
  id: 'x',
  title: 'T',
  description: '',
  price: '1',
  coverImage: '',
  lat: 0,
  lng: 0,
  agencyId: 'a',
  agentId: 'b',
  mode: 'SALE' as const,
  listingStatus: 'AVAILABLE' as const,
};

test('UNDER_OFFER is grayscale and fails availableOnly', () => {
  const p = { ...base, listingStatus: 'UNDER_OFFER' as const };
  expect(isGrayscaleCard(p)).toBe(true);
  expect(passesAvailableOnlyFilter(p)).toBe(false);
  expect(listingStatusLabel(p)).toBe('Sous offre');
});

test('RENT_SHORT always passes availableOnly', () => {
  expect(
    passesAvailableOnlyFilter({
      mode: 'RENT_SHORT',
      listingStatus: 'AVAILABLE',
    }),
  ).toBe(true);
});

test('AVAILABLE_SOON label uses countdown', () => {
  const in12 = new Date();
  in12.setDate(in12.getDate() + 12);
  expect(
    listingStatusLabel({
      listingStatus: 'AVAILABLE_SOON',
      availableFrom: in12.toISOString(),
    }),
  ).toBe('Bientôt · J-12');
});

test('sortMarketableFirst puts SOLD after AVAILABLE', () => {
  const sorted = sortMarketableFirst([
    { ...base, id: 's', listingStatus: 'SOLD' as const },
    { ...base, id: 'a', listingStatus: 'AVAILABLE' as const },
  ]);
  expect(sorted.map((x) => x.id)).toEqual(['a', 's']);
});
