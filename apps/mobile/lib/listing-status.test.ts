import { describe, expect, test } from 'bun:test';
import {
  isGrayscaleCard,
  listingStatusLabel,
  listingStatusCardLabel,
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

test('AVAILABLE_SOON detail label uses calendar date', () => {
  expect(
    listingStatusLabel({
      listingStatus: 'AVAILABLE_SOON',
      availableFrom: '2026-09-11T00:00:00.000Z',
    }),
  ).toBe('Disponible le 11 septembre');
});

test('AVAILABLE_SOON card label stays short', () => {
  expect(
    listingStatusCardLabel({
      listingStatus: 'AVAILABLE_SOON',
    }),
  ).toBe('Bientôt disponible');
});

test('sortMarketableFirst puts SOLD after AVAILABLE', () => {
  const sorted = sortMarketableFirst([
    { ...base, id: 's', listingStatus: 'SOLD' as const },
    { ...base, id: 'a', listingStatus: 'AVAILABLE' as const },
  ]);
  expect(sorted.map((x) => x.id)).toEqual(['a', 's']);
});
