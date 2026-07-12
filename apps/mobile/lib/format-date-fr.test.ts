import { describe, expect, test } from 'bun:test';
import {
  daysUntil,
  formatDateFr,
  formatDueLabel,
  formatRelativeDue,
} from './format-date-fr';

const noon = (isoDay: string): Date => {
  const [y, m, d] = isoDay.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 12, 0, 0);
};

describe('formatDateFr', () => {
  test('formats long French date', () => {
    expect(formatDateFr('2026-05-15')).toBe('15 mai 2026');
  });
});

describe('formatRelativeDue', () => {
  const now = noon('2026-07-10');

  test('aujourd’hui / demain', () => {
    expect(formatRelativeDue('2026-07-10', now)).toBe('aujourd’hui');
    expect(formatRelativeDue('2026-07-11', now)).toBe('demain');
  });

  test('dans N jours and 1 semaine', () => {
    expect(formatRelativeDue('2026-07-16', now)).toBe('dans 6 jours');
    expect(formatRelativeDue('2026-07-17', now)).toBe('dans 1 semaine');
    expect(formatRelativeDue('2026-07-18', now)).toBe('dans 8 jours');
  });

  test('en retard', () => {
    expect(formatRelativeDue('2026-07-07', now)).toBe('en retard de 3 jours');
  });
});

describe('formatDueLabel', () => {
  test('combines absolute and relative', () => {
    expect(formatDueLabel('2026-07-16', noon('2026-07-10'))).toBe(
      '16 juillet 2026 · dans 6 jours',
    );
  });
});

describe('daysUntil', () => {
  test('counts whole days', () => {
    expect(daysUntil('2026-07-10', noon('2026-07-10'))).toBe(0);
    expect(daysUntil('2026-07-12', noon('2026-07-10'))).toBe(2);
  });
});
