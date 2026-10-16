import { apiFetch } from '@/lib/api';
import type { PublicProperty } from '@/lib/owner/properties';
import { listManagedProperties } from '@/lib/owner/properties';

/** @deprecated Prefer listManagedProperties — org filter misses mandated owner-org listings. */
export async function listOrgProperties(
  organizationId: string,
): Promise<PublicProperty[]> {
  const response = await apiFetch<{
    data: PublicProperty[];
    meta: { total: number; limit: number; offset: number };
  }>(
    `/properties?organizationId=${encodeURIComponent(organizationId)}&limit=100`,
    { anonymous: true },
  );
  if (!response || !Array.isArray(response.data)) {
    throw new Error('Réponse invalide lors du chargement des biens de l’agence.');
  }
  return response.data;
}

export { listManagedProperties };
