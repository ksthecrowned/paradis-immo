import { apiFetch } from '@/lib/api';

export interface PublicAgency {
  id: string;
  name: string;
  type: string;
  shortName: string | null;
  isOfficial: boolean;
}

/** Marketplace agencies (public) — for owner mandate picker. */
export async function listPublicAgencies(): Promise<PublicAgency[]> {
  const result = await apiFetch<{ data: PublicAgency[] }>('/organizations', {
    anonymous: true,
  });
  return (result.data ?? []).filter((o) => o.type === 'AGENCY');
}
