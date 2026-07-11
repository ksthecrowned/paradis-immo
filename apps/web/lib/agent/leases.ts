import { apiFetch } from '@/lib/api';

export type PublicLease = {
  id: string;
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
  status: string;
  createdAt: string;
  mandateApprovalId?: string;
};

export type CreateLeaseInput = {
  propertyId: string;
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  currency: string;
};

export async function createLease(input: CreateLeaseInput): Promise<PublicLease> {
  return apiFetch<PublicLease>('/leases', {
    method: 'POST',
    body: input,
  });
}

export async function activateLease(leaseId: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${leaseId}/activate`, {
    method: 'PATCH',
  });
}

export async function listManagedLeases(): Promise<PublicLease[]> {
  return apiFetch<PublicLease[]>('/leases/managed');
}

export async function requestLeaseSign(leaseId: string): Promise<{
  id: string;
  status: string;
}> {
  return apiFetch(`/leases/${leaseId}/request-sign`, { method: 'POST' });
}
