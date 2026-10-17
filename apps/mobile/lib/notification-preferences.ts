import { apiFetch } from '@/lib/api';

export type NotificationCategory =
  | 'PAYMENTS'
  | 'VISITS'
  | 'STAYS'
  | 'SALES'
  | 'MAINTENANCE'
  | 'MESSAGES'
  | 'MANDATES'
  | 'LEASES'
  | 'ACCOUNT'
  | 'MARKETING';

export type PushNotificationPreference = {
  category: NotificationCategory;
  push: boolean;
};

export async function getPushNotificationPreferences(): Promise<
  PushNotificationPreference[]
> {
  return apiFetch<PushNotificationPreference[]>(
    '/users/me/notification-preferences',
  );
}

export async function updatePushNotificationPreference(
  preference: PushNotificationPreference,
): Promise<PushNotificationPreference[]> {
  return apiFetch<PushNotificationPreference[]>(
    '/users/me/notification-preferences',
    {
      method: 'PUT',
      body: { preferences: [preference] },
    },
  );
}
