import { describe, expect, test } from 'bun:test';
import {
  formatNotificationTime,
  mapInboxNotification,
  notificationBody,
  notificationKind,
  notificationTitle,
} from './inbox-notifications-map';

describe('inbox notifications', () => {
  test('maps visit notification', () => {
    const view = mapInboxNotification({
      id: 'n1',
      userId: 'u1',
      channel: 'PUSH',
      type: 'VISIT_CONFIRMED',
      payload: {},
      status: 'SENT',
      sentAt: '2026-09-03T10:00:00.000Z',
      readAt: null,
      createdAt: '2026-09-03T10:00:00.000Z',
    });
    expect(view.title).toBe('Visite confirmée');
    expect(view.kind).toBe('visit');
    expect(view.read).toBe(false);
    expect(view.link?.pathname).toBe('/activity');
  });

  test('titles and kinds', () => {
    expect(notificationTitle('RENT_OVERDUE')).toBe('Loyer en retard');
    expect(notificationKind('PAYMENT_RECEIPT_READY')).toBe('payment');
    expect(
      notificationBody('SOLVENCY_CHECK_REQUESTED', {
        organizationName: 'Paradis Immo',
      }),
    ).toContain('Paradis Immo');
  });

  test('relative time', () => {
    const iso = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    expect(formatNotificationTime(iso)).toContain('h');
  });
});
