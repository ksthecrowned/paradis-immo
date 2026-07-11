import { describe, expect, test } from 'bun:test';
import { nightsBetween, quoteShortStay } from './mock-conversion';

describe('nightsBetween', () => {
  test('counts whole nights', () => {
    expect(nightsBetween('2026-07-12', '2026-07-14')).toBe(2);
  });
  test('returns 0 when end <= start', () => {
    expect(nightsBetween('2026-07-12', '2026-07-12')).toBe(0);
  });
});

describe('quoteShortStay', () => {
  test('returns nights and FCFA total for property 3', () => {
    const q = quoteShortStay('3', '2026-07-12', '2026-07-14');
    expect(q.nights).toBe(2);
    expect(q.totalLabel).toContain('FCFA');
  });
});
