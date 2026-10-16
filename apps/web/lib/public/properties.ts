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
  // apiFetch already unwraps `{ statusCode, data }` → the array.
  return apiFetch<PublicProperty[]>(`/properties?${params}`, {
    anonymous: true,
  });
}
