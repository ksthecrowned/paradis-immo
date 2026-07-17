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

describe('buildPropertyDetailRows listing fees', () => {
  test('shows caution and agency fee when set', () => {
    const rows = buildPropertyDetailRows({
      ...base,
      depositMonths: 2,
      agencyFeeAmount: 50_000,
    });
    expect(rows.find((r) => r.key === 'depositMonths')?.value).toBe(
      '2 mois de loyer',
    );
    expect(rows.find((r) => r.key === 'agencyFee')?.value).toBe('50 000 FCFA');
  });

  test('omits zero or null fees', () => {
    const rows = buildPropertyDetailRows({
      ...base,
      depositMonths: 0,
      agencyFeeAmount: null,
    });
    expect(rows.find((r) => r.key === 'depositMonths')).toBeUndefined();
    expect(rows.find((r) => r.key === 'agencyFee')).toBeUndefined();
  });
});
