import { apiFetch } from '@/lib/api';
import type { PropertyStatus } from '@/lib/owner/properties';

export interface ModerationPropertyRow {
  id: string;
  title: string;
  mode: string;
  status: PropertyStatus;
  ownerId: string;
  owner: { id: string; name: string | null; avatarUrl: string | null };
}

export async function listPropertiesForModeration(
  limit = 100,
): Promise<ModerationPropertyRow[]> {
  const result = await apiFetch<{
    data: ModerationPropertyRow[];
    meta: { total: number; limit: number; offset: number };
  }>(`/admin/properties/moderation?limit=${limit}`);
  return result.data ?? [];
}

export interface ModeratePropertyResult {
  id: string;
  status: string;
  ownerId: string;
  updatedAt: string;
}

export async function moderateProperty(
  id: string,
  status: PropertyStatus,
  reason?: string,
): Promise<ModeratePropertyResult> {
  return apiFetch<ModeratePropertyResult>(`/admin/properties/${id}/moderate`, {
    method: 'PATCH',
    body: { status, ...(reason ? { reason } : {}) },
  });
}
