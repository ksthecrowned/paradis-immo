import { describe, expect, test } from 'bun:test';
import { priceBoundsForMode } from './filter-price-bounds';

describe('priceBoundsForMode', () => {
  test('SALE uses wide purchase range', () => {
    const b = priceBoundsForMode('SALE');
    expect(b.min).toBe(0);
    expect(b.max).toBe(200_000_000);
    expect(b.step).toBe(1_000_000);
  });

  test('RENT_LONG uses monthly rent range', () => {
    const b = priceBoundsForMode('RENT_LONG');
    expect(b.max).toBe(2_000_000);
    expect(b.step).toBe(25_000);
  });

  test('RENT_SHORT uses daily range', () => {
    const b = priceBoundsForMode('RENT_SHORT');
    expect(b.max).toBe(200_000);
    expect(b.step).toBe(5_000);
  });

  test('ALL uses the widest max', () => {
    expect(priceBoundsForMode('ALL').max).toBe(200_000_000);
  });
});
