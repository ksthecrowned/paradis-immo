import { apiFetch } from '@/lib/api';

export interface PublicMandate {
  id: string;
  propertyId: string;
  organizationId: string;
  assignedAgentId: string | null;
  status: string;
  startDate: string;
  endDate: string | null;
  createdAt: string;
}

export interface PublicOrgAgent {
  id: string;
  organizationId: string;
  name: string | null;
  phone: string | null;
}

export async function listManagedMandates(): Promise<PublicMandate[]> {
  return apiFetch<PublicMandate[]>('/mandates/managed');
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

export async function listOrganizationAgents(
  organizationId: string,
): Promise<PublicOrgAgent[]> {
  const org = await apiFetch<{ agents: PublicOrgAgent[] }>(
    `/organizations/${encodeURIComponent(organizationId)}`,
    { anonymous: true },
  );
  return org.agents ?? [];
}
