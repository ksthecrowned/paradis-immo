import { describe, expect, test } from 'bun:test';
import { nightsBetween, quoteShortStay } from './short-stay-quote';

describe('nightsBetween', () => {
  test('counts whole nights', () => {
    expect(nightsBetween('2026-07-12', '2026-07-14')).toBe(2);
  });
  test('returns 0 when end <= start', () => {
    expect(nightsBetween('2026-07-12', '2026-07-12')).toBe(0);
  });
});

describe('quoteShortStay', () => {
  test('uses property nightly price', () => {
    const q = quoteShortStay(
      { priceAmount: 45_000, minNights: 1, maxNights: null },
      '2026-07-12',
      '2026-07-14',
    );
    expect(q.nights).toBe(2);
    expect(q.totalAmount).toBe(90_000);
    expect(q.totalLabel).toContain('90 000');
    expect(q.error).toBeNull();
  });

  test('flags stay shorter than minNights', () => {
    const q = quoteShortStay(
      { priceAmount: 40_000, minNights: 3, maxNights: null },
      '2026-07-12',
      '2026-07-14',
    );
    expect(q.nights).toBe(2);
    expect(q.error).toContain('minimum 3');
  });

  test('flags stay longer than maxNights', () => {
    const q = quoteShortStay(
      { priceAmount: 40_000, minNights: 1, maxNights: 2 },
      '2026-07-12',
      '2026-07-16',
    );
    expect(q.nights).toBe(4);
    expect(q.error).toContain('maximum 2');
  });
});
