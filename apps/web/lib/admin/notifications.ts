import { apiFetch, apiFetchPaginated } from '@/lib/api';

export type AdminNotificationStatus = 'FAILED' | 'QUEUED' | 'SENT' | 'PENDING';

export interface AdminFailedNotification {
  id: string;
  type: string;
  channel: string;
  status: AdminNotificationStatus | string;
  attempts: number;
  lastError: string | null;
  retryAfter: string | null;
  createdAt: string;
  sentAt: string | null;
  recipient: {
    userId: string;
    phoneMasked: string | null;
    name: string | null;
  };
  providerMessageId: string | null;
}

export interface AdminRetryResult {
  id: string;
  status: string;
  attempts?: number;
  lastError?: string | null;
}

export const NOTIFICATION_STATUS_LABELS: Record<string, string> = {
  FAILED: 'Échec',
  QUEUED: 'En file',
  SENT: 'Envoyée',
  PENDING: 'En attente',
};

export function notificationStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  if (status === 'FAILED') return 'danger';
  if (status === 'QUEUED') return 'warning';
  if (status === 'SENT') return 'success';
  return 'neutral';
}

export async function listFailedNotifications(options?: {
  page?: number;
  pageSize?: number;
  status?: 'FAILED' | 'QUEUED' | 'ALL';
}): Promise<{
  data: AdminFailedNotification[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}> {
  const params = new URLSearchParams({
    page: String(options?.page ?? 1),
    pageSize: String(options?.pageSize ?? 50),
  });
  if (options?.status && options.status !== 'ALL') {
    params.set('status', options.status);
  }
  return apiFetchPaginated<AdminFailedNotification>(
    `/admin/notifications/failed?${params}`,
  );
}

export async function retryNotification(
  id: string,
): Promise<AdminRetryResult> {
  return apiFetch<AdminRetryResult>(
    `/admin/notifications/${encodeURIComponent(id)}/retry`,
    { method: 'POST' },
  );
}
