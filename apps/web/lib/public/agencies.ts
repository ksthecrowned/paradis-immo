import { apiFetch } from '@/lib/api';

export interface PublicAgency {
  id: string;
  name: string;
  type: string;
  shortName: string | null;
  /** Zone / ville affichée — recherche par zone côté formulaire de mandat. */
  cityLabel: string | null;
  address: string | null;
  isOfficial: boolean;
}

/**
 * Marketplace agencies (public) — for owner mandate picker.
 * Includes the official PLATFORM agency (spec: "official platform + AGENCY
 * orgs") so mandates against the platform agency resolve its name too.
 */
export async function listPublicAgencies(): Promise<PublicAgency[]> {
  const result = await apiFetch<{ data: PublicAgency[] }>('/organizations', {
    anonymous: true,
  });
  return (result.data ?? []).filter(
    (o) => o.type === 'AGENCY' || o.type === 'PLATFORM',
  );
}
