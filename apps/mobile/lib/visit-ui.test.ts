import { describe, expect, test } from 'bun:test';
import { groupVisitSlotsByDay } from './visit-ui';
import type { PublicVisitSlot } from './visits';

const slots: PublicVisitSlot[] = [
  {
    id: 's1',
    propertyId: 'p1',
    startAt: '2026-07-14T09:00:00.000Z',
    endAt: '2026-07-14T09:45:00.000Z',
    status: 'AVAILABLE',
    source: 'MANUAL',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 's2',
    propertyId: 'p1',
    startAt: '2026-07-14T13:00:00.000Z',
    endAt: '2026-07-14T13:45:00.000Z',
    status: 'BOOKED',
    source: 'MANUAL',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
  {
    id: 's3',
    propertyId: 'p1',
    startAt: '2026-07-15T09:00:00.000Z',
    endAt: '2026-07-15T09:45:00.000Z',
    status: 'AVAILABLE',
    source: 'MANUAL',
    createdAt: '2026-07-01T00:00:00.000Z',
  },
];

describe('groupVisitSlotsByDay', () => {
  test('groups available slots and skips booked', () => {
    const { days, slotsForDay } = groupVisitSlotsByDay(slots, {
      visitType: 'FREE',
      visitPrice: null,
    });
    expect(days.length).toBe(2);
    expect(slotsForDay(days[0]!.key)).toHaveLength(1);
    expect(slotsForDay(days[0]!.key)[0]!.paid).toBe(false);
  });

  test('marks paid slots with price label', () => {
    const { days, slotsForDay } = groupVisitSlotsByDay(slots, {
      visitType: 'PAID',
      visitPrice: 5000,
    });
    const row = slotsForDay(days[0]!.key)[0]!;
    expect(row.paid).toBe(true);
    expect(row.priceLabel).toContain('5');
    expect(row.priceLabel).toContain('FCFA');
  });
});
