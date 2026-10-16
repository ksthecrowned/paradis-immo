import { apiFetchPaginated } from '@/lib/api';

export type OrganizationType = 'AGENCY' | 'OWNER' | 'PLATFORM';
export type AffiliationStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';

export interface AdminOrganizationRow {
  id: string;
  name: string;
  type: OrganizationType;
  affiliationStatus: AffiliationStatus | null;
  cityLabel: string | null;
  email: string | null;
  phone: string | null;
  isOfficial: boolean;
  verified: boolean;
  memberCount: number;
  propertyCount: number;
  approvedAt: string | null;
  createdAt: string;
}

export const ORGANIZATION_TYPE_LABELS: Record<OrganizationType, string> = {
  AGENCY: 'Agence',
  OWNER: 'Propriétaire',
  PLATFORM: 'Plateforme',
};

export const AFFILIATION_LABELS: Record<AffiliationStatus, string> = {
  PENDING: 'Adhésion en attente',
  APPROVED: 'Adhésion validée',
  SUSPENDED: 'Adhésion suspendue',
};

export function affiliationTone(
  status: AffiliationStatus | null,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'APPROVED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'SUSPENDED') return 'danger';
  return 'neutral';
}

export async function listAdminOrganizations(options?: {
  type?: OrganizationType;
  page?: number;
  pageSize?: number;
}): Promise<{ data: AdminOrganizationRow[]; meta: { total: number } }> {
  const params = new URLSearchParams();
  if (options?.type) params.set('type', options.type);
  params.set('page', String(options?.page ?? 1));
  params.set('pageSize', String(options?.pageSize ?? 50));
  const result = await apiFetchPaginated<AdminOrganizationRow>(
    `/admin/organizations?${params.toString()}`,
  );
  return { data: result.data, meta: { total: result.meta.total } };
}
