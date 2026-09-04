import { apiFetch } from '@/lib/api';
import type { PublicProperty } from '@/lib/owner/properties';
import { listManagedProperties } from '@/lib/owner/properties';

/** @deprecated Prefer listManagedProperties — org filter misses mandated owner-org listings. */
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

export { listManagedProperties };
