import { apiFetch } from '@/lib/api';

export interface AgencyStorefrontProfile {
  id: string;
  name: string;
  type: string;
  shortName: string | null;
  tagline: string | null;
  description: string | null;
  address: string | null;
  cityLabel: string | null;
  phone: string | null;
  email: string | null;
  foundedYear: number | null;
  logoColor: string | null;
}

export type UpdateAgencyStorefront = Pick<
  AgencyStorefrontProfile,
  | 'name'
  | 'shortName'
  | 'tagline'
  | 'description'
  | 'address'
  | 'cityLabel'
  | 'phone'
  | 'email'
>;

export function getAgencyStorefront(
  organizationId: string,
): Promise<AgencyStorefrontProfile> {
  return apiFetch<AgencyStorefrontProfile>(
    `/organizations/${encodeURIComponent(organizationId)}/profile`,
  );
}

export function updateAgencyStorefront(
  organizationId: string,
  storefront: UpdateAgencyStorefront,
): Promise<AgencyStorefrontProfile> {
  return apiFetch<AgencyStorefrontProfile>(
    `/organizations/${encodeURIComponent(organizationId)}`,
    { method: 'PATCH', body: storefront },
  );
}
