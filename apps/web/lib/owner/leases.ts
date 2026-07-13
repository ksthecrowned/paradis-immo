import { apiFetch } from '@/lib/api';

export interface PublicLease {
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
  tenantId: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  currency: string;
}

export async function listManagedLeases(): Promise<PublicLease[]> {
  return apiFetch<PublicLease[]>('/leases/managed');
}

export async function createLease(
  input: CreateLeaseInput,
): Promise<PublicLease> {
  return apiFetch<PublicLease>('/leases', { method: 'POST', body: input });
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
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'TERMINATED' || status === 'CANCELLED') return 'neutral';
  return 'neutral';
}
