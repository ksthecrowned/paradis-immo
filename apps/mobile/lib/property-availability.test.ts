import { describe, expect, test } from 'bun:test';
import {
  propertyAvailabilityBadgeLabel,
  unavailableReasonLabel,
  type Property,
} from '../types/property';

const base: Property = {
  id: 'x',
  title: 'T',
  description: '',
  price: '1',
  coverImage: '',
  mode: 'SALE',
  lat: 0,
  lng: 0,
  agencyId: 'a',
  agentId: 'b',
  availability: 'AVAILABLE',
};

describe('property availability', () => {
  test('badge null when available', () => {
    expect(propertyAvailabilityBadgeLabel(base)).toBeNull();
  });

  test('badge for rented', () => {
    expect(
      propertyAvailabilityBadgeLabel({
        ...base,
        mode: 'RENT_LONG',
        availability: 'UNAVAILABLE',
        unavailableReason: 'RENTED',
      }),
    ).toBe('Indispo · Loué');
  });

  test('reason labels', () => {
    expect(unavailableReasonLabel('SOLD')).toBe('Vendu');
    expect(unavailableReasonLabel('RESERVED')).toBe('Réservé');
  });
});
