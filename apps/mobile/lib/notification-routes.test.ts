import { describe, expect, test } from 'bun:test';
import { resolveNotificationRoute } from './notification-routes';

describe('resolveNotificationRoute — visitId deep link', () => {
  test('routes a visitId payload to the visit detail screen', () => {
    expect(resolveNotificationRoute({ visitId: 'v-123' })).toEqual({
      pathname: '/visit-detail/[id]',
      params: { id: 'v-123' },
    });
  });

  test('paymentId still wins over visitId (_backward compat order)', () => {
    expect(
      resolveNotificationRoute({ visitId: 'v-1', paymentId: 'p-2' }),
    ).toEqual({ pathname: '/payment/[id]', params: { id: 'p-2' } });
  });

  test('unknown payloads still resolve to null', () => {
    expect(resolveNotificationRoute({ type: 'SOMETHING_ELSE' })).toBeNull();
  });

  test('legacy screen routes are unchanged', () => {
    expect(resolveNotificationRoute({ screen: 'activity' })).toEqual({
      pathname: '/activity',
    });
  });
});
