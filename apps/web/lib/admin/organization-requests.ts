import { apiFetch } from '@/lib/api';

/** Mirrors the OrganizationRequest Prisma enums (spec 02). */
export type OrganizationRequestType = 'OWNER' | 'AGENCY';
export type OrganizationRequestStatus = 'PENDING' | 'INVITED' | 'REJECTED';

export interface AdminOrgRequestRow {
  id: string;
  type: OrganizationRequestType;
  name: string;
  legalName: string | null;
  rccm: string | null;
  niu: string | null;
  address: string | null;
  cityLabel: string | null;
  phone: string | null;
  email: string;
  description: string | null;
  submittedById: string | null;
  status: OrganizationRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
}

export const ORG_REQUEST_TYPE_LABELS: Record<OrganizationRequestType, string> = {
  OWNER: 'Propriétaire',
  AGENCY: 'Agence',
};

export const ORG_REQUEST_STATUS_LABELS: Record<
  OrganizationRequestStatus,
  string
> = {
  PENDING: 'En attente',
  INVITED: 'Invité',
  REJECTED: 'Rejeté',
};

export function orgRequestStatusTone(
  status: OrganizationRequestStatus,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'PENDING') return 'warning';
  if (status === 'INVITED') return 'success';
  if (status === 'REJECTED') return 'danger';
  return 'neutral';
}

/**
 * Human-friendly sign-up reference (spec 02), identical to the API helper
 * `formatRequestReference()` in apps/api agency.service.ts — KEEP IN SYNC.
 */
export function orgRequestReference(row: {
  id: string;
  type: string;
}): string {
  const kind = row.type === 'AGENCY' ? 'AG' : 'PR';
  return `PI-${kind}-${row.id.slice(0, 8).toUpperCase()}`;
}

export async function listAdminOrgRequests(options?: {
  status?: OrganizationRequestStatus;
}): Promise<AdminOrgRequestRow[]> {
  const search = new URLSearchParams();
  if (options?.status) search.set('status', options.status);
  const qs = search.toString();
  const result = await apiFetch<{ requests: AdminOrgRequestRow[] }>(
    `/admin/organization-requests${qs ? `?${qs}` : ''}`,
  );
  return result.requests ?? [];
}

export async function reviewAdminOrgRequest(
  id: string,
  input: { action: 'INVITE' | 'REJECT'; rejectionReason?: string },
): Promise<{ inviteUrl: string | null }> {
  const result = await apiFetch<{
    organizationId: string | null;
    inviteUrl: string | null;
  }>(`/admin/organization-requests/${id}`, {
    method: 'PATCH',
    body: input,
  });
  return { inviteUrl: result.inviteUrl ?? null };
}
