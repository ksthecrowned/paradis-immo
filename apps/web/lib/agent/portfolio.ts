import { apiFetch } from '@/lib/api';
import type { PublicProperty } from '@/lib/owner/properties';
import { listManagedProperties } from '@/lib/owner/properties';

/** @deprecated Prefer listManagedProperties — org filter misses mandated owner-org listings. */
export async function listOrgProperties(
  organizationId: string,
): Promise<PublicProperty[]> {
  // apiFetch already unwraps `{ statusCode, data }` → the array.
  return apiFetch<PublicProperty[]>(
    `/properties?organizationId=${encodeURIComponent(organizationId)}&limit=100`,
    { anonymous: true },
  );
}

export { listManagedProperties };
