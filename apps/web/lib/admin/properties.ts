import { apiFetch } from '@/lib/api';
import type { PublicProperty, PropertyStatus } from '@/lib/owner/properties';

export async function listPropertiesForModeration(
  limit = 100,
): Promise<PublicProperty[]> {
  const result = await apiFetch<{
    data: PublicProperty[];
    meta: { total: number; limit: number; offset: number };
  }>(`/properties?limit=${limit}`, { anonymous: true });
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
