import { describe, expect, test } from 'bun:test';
import {
  canWithdrawApplication,
  isValidMoveInDate,
  rentalApplicationStatusLabel,
} from './applications-utils';

describe('rental applications', () => {
  test('accepts a valid current or future move-in date only', () => {
    const today = new Date().toISOString().slice(0, 10);
    expect(isValidMoveInDate(today)).toBe(true);
    expect(isValidMoveInDate('2026-02-30')).toBe(false);
    expect(isValidMoveInDate('17-10-2026')).toBe(false);
    expect(isValidMoveInDate('2020-01-01')).toBe(false);
  });

  test('allows withdrawal only before a final decision', () => {
    expect(canWithdrawApplication('SUBMITTED')).toBe(true);
    expect(canWithdrawApplication('SOLVENCY_PENDING')).toBe(true);
    expect(canWithdrawApplication('ACCEPTED')).toBe(false);
    expect(canWithdrawApplication('REJECTED')).toBe(false);
  });

  test('uses readable status labels', () => {
    expect(rentalApplicationStatusLabel('SOLVENCY_PENDING')).toContain(
      'solvabilité',
    );
  });
});
