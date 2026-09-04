import { apiFetch } from '@/lib/api';
import type { PublicInboxNotification } from '@/lib/inbox-notifications-types';

export type { PublicInboxNotification } from '@/lib/inbox-notifications-types';
export type {
  InboxNotificationView,
  NotificationKind,
} from '@/lib/inbox-notifications-map';
export {
  formatNotificationTime,
  mapInboxNotification,
  notificationBody,
  notificationKind,
  notificationTitle,
} from '@/lib/inbox-notifications-map';

export async function listMyNotifications(): Promise<PublicInboxNotification[]> {
  return apiFetch<PublicInboxNotification[]>('/notifications/my');
}

export async function markNotificationRead(
  id: string,
): Promise<PublicInboxNotification> {
  return apiFetch<PublicInboxNotification>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/notifications/my/read-all', {
    method: 'PATCH',
  });
}
