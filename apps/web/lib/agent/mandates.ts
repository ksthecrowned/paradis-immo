import { apiFetch } from '@/lib/api';
import type { MandateConditions, PublicMandate } from '@/lib/owner/mandates';

export type { PublicMandate };
export type {
  MandateConditions,
  PublicMandateApproval,
  PublicMandateDetail,
} from '@/lib/owner/mandates';
export { getMandateDetail } from '@/lib/owner/mandates';

export interface PublicOrgAgent {
  id: string;
  organizationId: string;
  name: string | null;
  phone: string | null;
}

export interface ManagedMandatesFilters {
  status?: string;
  scope?: string;
  page?: number;
  pageSize?: number;
}

/** GET /mandates/managed — mandats de mes agences (filtres status/scope). */
export async function listManagedMandates(
  filters: ManagedMandatesFilters = {},
): Promise<PublicMandate[]> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.scope) params.set('scope', filters.scope);
  if (filters.page) params.set('page', String(filters.page));
  if (filters.pageSize) params.set('pageSize', String(filters.pageSize));
  const qs = params.toString();
  return apiFetch<PublicMandate[]>(`/mandates/managed${qs ? `?${qs}` : ''}`);
}

export async function assignMandate(
  mandateId: string,
  agentUserId: string | null,
): Promise<PublicMandate> {
  return apiFetch<PublicMandate>(`/mandates/${mandateId}/assign`, {
    method: 'PATCH',
    body: { agentUserId },
  });
}

/** POST /mandates/:id/accept — le gérant accepte la proposition (→ ACTIVE). */
export async function acceptMandate(mandateId: string): Promise<PublicMandate> {
  return apiFetch<PublicMandate>(`/mandates/${mandateId}/accept`, {
    method: 'POST',
    body: {},
  });
}

/** POST /mandates/:id/decline — refus motivé. */
export async function declineMandate(
  mandateId: string,
  reason: string,
): Promise<PublicMandate> {
  return apiFetch<PublicMandate>(`/mandates/${mandateId}/decline`, {
    method: 'POST',
    body: { reason },
  });
}

/** POST /mandates/:id/counter — contre-proposition (nouvelle version). */
export async function counterMandate(
  mandateId: string,
  input: MandateConditions & { reason?: string },
): Promise<PublicMandate> {
  return apiFetch<PublicMandate>(`/mandates/${mandateId}/counter`, {
    method: 'POST',
    body: input,
  });
}

/** POST /mandates/:id/approvals — soumettre une action au propriétaire (US 9). */
export async function requestApproval(
  mandateId: string,
  input: {
    actionType: string;
    sourceType?: string;
    sourceId?: string;
    payload?: Record<string, unknown>;
  },
): Promise<{ id: string }> {
  return apiFetch<{ id: string }>(`/mandates/${mandateId}/approvals`, {
    method: 'POST',
    body: input,
  });
}

export async function listOrganizationAgents(
  organizationId: string,
): Promise<PublicOrgAgent[]> {
  const org = await apiFetch<{ agents: PublicOrgAgent[] }>(
    `/organizations/${encodeURIComponent(organizationId)}`,
    { anonymous: true },
  );
  return org.agents ?? [];
}
