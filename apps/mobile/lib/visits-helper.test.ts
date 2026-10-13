import { describe, expect, test } from 'bun:test';
import {
  canCancelBooking,
  canRescheduleBooking,
  visitHoldCountdown,
  visitRefundQuote,
} from './visit-policies';

const in24h = (offsetHours: number): string =>
  new Date(Date.now() + offsetHours * 3_600_000).toISOString();

describe('visitRefundQuote', () => {
  test('paid + confirmed > 24h → 100%', () => {
    const q = visitRefundQuote({
      status: 'CONFIRMED',
      slotStartAt: in24h(30),
      priceAmount: '5000',
      currency: 'XAF',
      paymentId: 'p1',
    });
    expect(q?.refundPercent).toBe(100);
  });

  test('paid + confirmed 2–24h → 50%', () => {
    const q = visitRefundQuote({
      status: 'CONFIRMED',
      slotStartAt: in24h(5),
      priceAmount: '5000',
      paymentId: 'p1',
    });
    expect(q?.refundPercent).toBe(50);
  });

  test('paid + confirmed < 2h → 0%', () => {
    const q = visitRefundQuote({
      status: 'CONFIRMED',
      slotStartAt: in24h(1),
      priceAmount: '5000',
      paymentId: 'p1',
    });
    expect(q?.refundPercent).toBe(0);
  });

  test('free visit (no price/payment) → null', () => {
    expect(
      visitRefundQuote({
        status: 'CONFIRMED',
        slotStartAt: in24h(30),
        priceAmount: null,
        currency: null,
        paymentId: null,
      }),
    ).toBeNull();
  });

  test('already cancelled → null', () => {
    expect(
      visitRefundQuote({
        status: 'CANCELLED',
        slotStartAt: in24h(30),
        priceAmount: '5000',
        paymentId: 'p1',
      }),
    ).toBeNull();
  });
});

describe('visitHoldCountdown', () => {
  test('PENDING + hold in the future → m:ss', () => {
    const s = visitHoldCountdown({
      status: 'PENDING',
      holdExpiresAt: new Date(Date.now() + 65_000).toISOString(),
    });
    expect(s).toMatch(/^\d+:\d{2}$/);
  });

  test('hold in the past → expiry label', () => {
    expect(
      visitHoldCountdown({
        status: 'PENDING',
        holdExpiresAt: new Date(Date.now() - 1_000).toISOString(),
      }),
    ).toBe('Hold expiré');
  });

  test('non-PENDING → null', () => {
    expect(
      visitHoldCountdown({ status: 'CONFIRMED', holdExpiresAt: null }),
    ).toBeNull();
  });
});

describe('canCancelBooking / canRescheduleBooking', () => {
  test('CONFIRMED upcoming → both true', () => {
    const b = { status: 'CONFIRMED', slotStartAt: in24h(5) };
    expect(canCancelBooking(b)).toBe(true);
    expect(canRescheduleBooking(b)).toBe(true);
  });

  test('CANCELLED → both false', () => {
    const b = { status: 'CANCELLED', slotStartAt: in24h(5) };
    expect(canCancelBooking(b)).toBe(false);
    expect(canRescheduleBooking(b)).toBe(false);
  });

  test('COMPLETED → both false', () => {
    const b = { status: 'COMPLETED', slotStartAt: in24h(-1) };
    expect(canCancelBooking(b)).toBe(false);
    expect(canRescheduleBooking(b)).toBe(false);
  });
});
