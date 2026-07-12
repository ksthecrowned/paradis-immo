import { describe, expect, test } from 'bun:test';
import {
  addDays,
  isInRange,
  monthGrid,
  toDayKey,
} from './calendar';

describe('calendar', () => {
  test('toDayKey formats local date', () => {
    expect(toDayKey(new Date(2026, 6, 12))).toBe('2026-07-12');
  });

  test('addDays', () => {
    expect(addDays('2026-07-12', 2)).toBe('2026-07-14');
  });

  test('monthGrid monday-first for July 2026', () => {
    // 2026-07-01 is Wednesday → 2 leading nulls (Mon, Tue)
    const grid = monthGrid('2026-07-01');
    expect(grid[0]).toBeNull();
    expect(grid[1]).toBeNull();
    expect(grid[2]).toBe('2026-07-01');
    expect(grid.filter(Boolean)).toHaveLength(31);
  });

  test('isInRange exclusive ends', () => {
    expect(isInRange('2026-07-13', '2026-07-12', '2026-07-15')).toBe(true);
    expect(isInRange('2026-07-12', '2026-07-12', '2026-07-15')).toBe(false);
  });
});
