import { describe, expect, test } from 'bun:test';
import { buildPropertyDetailRows } from './neighborhood';
import type { Property } from '@/types/property';

const base: Property = {
  id: 'p1',
  title: 'Test',
  description: 'Desc',
  price: '100 000 FCFA',
  priceAmount: 100000,
  coverImage: '',
  mode: 'RENT_LONG',
  agencyId: 'a1',
  agentId: 'ag1',
  listingStatus: 'AVAILABLE',
  lat: 0,
  lng: 0,
};

describe('buildPropertyDetailRows visit fee', () => {
  test('shows Gratuit when visit is FREE', () => {
    const rows = buildPropertyDetailRows({
      ...base,
      visitEnabled: true,
      visitType: 'FREE',
      visitPrice: null,
    });
    expect(rows.find((r) => r.key === 'visitFee')).toEqual({
      key: 'visitFee',
      label: 'Frais de visite',
      value: 'Gratuit',
      icon: 'cash-outline',
    });
  });

  test('shows amount when visit is PAID', () => {
    const rows = buildPropertyDetailRows({
      ...base,
      visitEnabled: true,
      visitType: 'PAID',
      visitPrice: 5000,
    });
    expect(rows.find((r) => r.key === 'visitFee')?.value).toBe('5 000 FCFA');
  });

  test('omits row when visit disabled', () => {
    const rows = buildPropertyDetailRows({
      ...base,
      visitEnabled: false,
      visitType: 'PAID',
      visitPrice: 5000,
    });
    expect(rows.find((r) => r.key === 'visitFee')).toBeUndefined();
  });
});
