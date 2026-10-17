import { describe, expect, test } from 'bun:test';
import { sanitizeReturnTo } from './auth-return-to';

describe('sanitizeReturnTo', () => {
  test('preserves allowed property and payment paths', () => {
    expect(sanitizeReturnTo('/property/123/book')).toBe('/property/123/book');
    expect(sanitizeReturnTo('/payment/456?bookingId=123')).toBe(
      '/payment/456?bookingId=123',
    );
  });

  test('rejects external, traversal, and similarly prefixed paths', () => {
    expect(sanitizeReturnTo('//example.com')).toBe('/(tabs)');
    expect(sanitizeReturnTo('/property/../admin')).toBe('/(tabs)');
    expect(sanitizeReturnTo('/propertyish/123')).toBe('/(tabs)');
    expect(sanitizeReturnTo('/unknown')).toBe('/(tabs)');
  });
});
