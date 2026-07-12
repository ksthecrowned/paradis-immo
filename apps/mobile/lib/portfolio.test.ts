import { describe, expect, test } from 'bun:test';
import type { PublicBooking } from './bookings';
import type { PublicLease } from './leases';
import {
  buildPortfolioProperties,
  portfolioRelationLabel,
  type PortfolioSources,
} from './portfolio-build';
import type { PublicSaleInquiry } from './sales';
import type { PublicVisitBooking } from './visits';

const lease = (
  partial: Partial<PublicLease> &
    Pick<PublicLease, 'id' | 'propertyId' | 'status'>,
): PublicLease => ({
  tenantId: 'u1',
  startDate: '2026-01-01',
  endDate: '2027-01-01',
  monthlyRent: '100000',
  deposit: '200000',
  currency: 'XAF',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...partial,
});

const booking = (
  partial: Partial<PublicBooking> &
    Pick<PublicBooking, 'id' | 'propertyId' | 'status'>,
): PublicBooking => ({
  userId: 'u1',
  startDate: '2026-07-01',
  endDate: '2026-07-03',
  totalPrice: '50000',
  currency: 'XAF',
  createdAt: '2026-06-01T00:00:00.000Z',
  ...partial,
});

const visit = (
  partial: Partial<PublicVisitBooking> &
    Pick<PublicVisitBooking, 'id' | 'propertyId' | 'status'>,
): PublicVisitBooking => ({
  slotId: 's1',
  userId: 'u1',
  paymentId: null,
  createdAt: '2026-07-11T00:00:00.000Z',
  ...partial,
});

const inquiry = (
  partial: Partial<PublicSaleInquiry> &
    Pick<PublicSaleInquiry, 'id' | 'propertyId' | 'status'>,
): PublicSaleInquiry => ({
  userId: 'u1',
  message: null,
  createdAt: '2026-07-10T00:00:00.000Z',
  ...partial,
});

describe('buildPortfolioProperties', () => {
  test('one card per propertyId', () => {
    const sources: PortfolioSources = {
      leases: [lease({ id: 'l1', propertyId: 'p1', status: 'ACTIVE' })],
      bookings: [
        booking({ id: 'b1', propertyId: 'p1', status: 'CONFIRMED' }),
        booking({ id: 'b2', propertyId: 'p2', status: 'CONFIRMED' }),
      ],
      visits: [visit({ id: 'v1', propertyId: 'p2', status: 'CONFIRMED' })],
      inquiries: [],
    };
    const items = buildPortfolioProperties(sources);
    const ids = items.map((i) => i.propertyId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain('p1');
    expect(ids).toContain('p2');
  });

  test('active lease property is tenant primary', () => {
    const items = buildPortfolioProperties({
      leases: [lease({ id: 'l1', propertyId: '2', status: 'ACTIVE' })],
      bookings: [
        booking({ id: 'b1', propertyId: '2', status: 'CONFIRMED' }),
      ],
      visits: [],
      inquiries: [inquiry({ id: 'i1', propertyId: '2', status: 'NEW' })],
    });
    const apt = items.find((i) => i.propertyId === '2');
    expect(apt?.primaryRelation).toBe('tenant');
    expect(portfolioRelationLabel('tenant')).toBe('Locataire');
  });

  test('sorted by lastAt desc', () => {
    const items = buildPortfolioProperties({
      leases: [],
      bookings: [
        booking({
          id: 'b1',
          propertyId: 'old',
          status: 'CONFIRMED',
          startDate: '2026-01-01',
        }),
        booking({
          id: 'b2',
          propertyId: 'new',
          status: 'CONFIRMED',
          startDate: '2026-07-01',
        }),
      ],
      visits: [],
      inquiries: [],
    });
    expect(items[0]?.propertyId).toBe('new');
    expect(items[1]?.propertyId).toBe('old');
  });

  test('ignores cancelled bookings and visits', () => {
    const items = buildPortfolioProperties({
      leases: [],
      bookings: [
        booking({ id: 'b1', propertyId: 'p1', status: 'CANCELLED' }),
      ],
      visits: [visit({ id: 'v1', propertyId: 'p2', status: 'CANCELLED' })],
      inquiries: [],
    });
    expect(items).toHaveLength(0);
  });
});
