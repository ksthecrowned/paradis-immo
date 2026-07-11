import { apiFetch } from '@/lib/api';

export interface PublicMandateApproval {
  id: string;
  mandateId: string;
  actionType: string;
  payload: Record<string, unknown>;
  status: string;
  decidedAt: string | null;
  decidedBy: string | null;
  createdAt: string;
}

export async function listPendingApprovals(): Promise<PublicMandateApproval[]> {
  return apiFetch<PublicMandateApproval[]>('/mandates/pending-approvals');
}

export async function createMandate(input: {
  propertyId: string;
  organizationId: string;
  endDate?: string;
}): Promise<{ id: string; propertyId: string; organizationId: string }> {
  return apiFetch('/mandates', {
    method: 'POST',
    body: input,
  });
}

export async function decideApproval(
  id: string,
  approve: boolean,
  note?: string,
): Promise<PublicMandateApproval> {
  return apiFetch<PublicMandateApproval>(`/mandates/approvals/${id}`, {
    method: 'PATCH',
    body: { approve, ...(note ? { note } : {}) },
  });
}

export function mandateActionLabel(actionType: string): string {
  const map: Record<string, string> = {
    LEASE_SIGN: 'Signature de bail',
    RENT_REDUCTION: 'Baisse de loyer',
    MAJOR_REPAIR: 'Travaux importants',
  };
  return map[actionType] ?? actionType;
}

export function approvalStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'En attente',
    APPROVED: 'Approuvé',
    REJECTED: 'Rejeté',
  };
  return map[status] ?? status;
}
