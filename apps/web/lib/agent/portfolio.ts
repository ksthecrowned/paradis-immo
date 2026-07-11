import { apiFetch } from '@/lib/api';
import type { PublicProperty } from '@/lib/owner/properties';

export async function listOrgProperties(
  organizationId: string,
): Promise<PublicProperty[]> {
  const result = await apiFetch<{
    data: PublicProperty[];
    meta: { total: number; limit: number; offset: number };
  }>(
    `/properties?organizationId=${encodeURIComponent(organizationId)}&limit=100`,
    { anonymous: true },
  );
  return result.data ?? [];
}
