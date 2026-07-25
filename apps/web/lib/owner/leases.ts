import { apiFetch } from '@/lib/api';

export interface PublicLease {
  id: string;
  propertyId: string;
  tenantId: string;
  tenantPhone?: string | null;
  tenantName?: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
  status: string;
  createdAt: string;
}

export interface PublicRentScheduleEntry {
  id: string;
  leaseId: string;
  dueDate: string;
  amount: string;
  currency: string;
  status: string;
}

export interface CreateLeaseInput {
  propertyId: string;
  tenantPhone?: string;
  tenantName?: string;
  tenantId?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  currency: string;
}

export type UpdateLeaseInput = Partial<
  Omit<CreateLeaseInput, 'propertyId'>
>;

export interface UserLookupResult {
  id: string;
  name: string | null;
  phone: string;
}

export async function lookupUserByPhone(
  phone: string,
): Promise<UserLookupResult> {
  return apiFetch<UserLookupResult>(
    `/users/lookup?phone=${encodeURIComponent(phone)}`,
  );
}

export async function listManagedLeases(): Promise<PublicLease[]> {
  return apiFetch<PublicLease[]>('/leases/managed');
}

export async function createLease(
  input: CreateLeaseInput,
): Promise<PublicLease> {
  return apiFetch<PublicLease>('/leases', { method: 'POST', body: input });
}

export async function updateLease(
  id: string,
  input: UpdateLeaseInput,
): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function getLease(id: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}`);
}

export async function activateLease(id: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}/activate`, { method: 'PATCH' });
}

export async function getLeaseSchedule(
  id: string,
): Promise<PublicRentScheduleEntry[]> {
  return apiFetch<PublicRentScheduleEntry[]>(`/leases/${id}/schedule`);
}

export function leaseStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon',
    ACTIVE: 'Actif',
    TERMINATED: 'Terminé',
    CANCELLED: 'Annulé',
  };
  return map[status] ?? status;
}

export function leaseStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'CANCELLED' || status === 'TERMINATED') return 'danger';
  return 'neutral';
}
