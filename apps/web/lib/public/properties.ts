import { apiFetch } from '@/lib/api';
import type { PublicProperty, PropertyMode } from '@/lib/owner/properties';

export async function listActiveProperties(
  limit = 6,
  mode?: PropertyMode,
): Promise<PublicProperty[]> {
  const params = new URLSearchParams({
    status: 'ACTIVE',
    limit: String(limit),
  });
  if (mode) params.set('mode', mode);
  const result = await apiFetch<{
    data: PublicProperty[];
    meta: { total: number; limit: number; offset: number };
  }>(`/properties?${params}`, { anonymous: true });
  return result.data ?? [];
}
