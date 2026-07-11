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

export async function listMyLeases(): Promise<PublicLease[]> {
  return apiFetch<PublicLease[]>('/leases/my');
}

export async function getLeaseSchedule(
  leaseId: string,
): Promise<PublicRentScheduleEntry[]> {
  return apiFetch<PublicRentScheduleEntry[]>(`/leases/${leaseId}/schedule`);
}

export function leaseStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon',
    ACTIVE: 'Actif',
    TERMINATED: 'Terminé',
  };
  return map[status] ?? status;
}

export function leaseStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'TERMINATED') return 'danger';
  return 'neutral';
}

export function rentScheduleStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'À payer',
    PAID: 'Payé',
    OVERDUE: 'En retard',
  };
  return map[status] ?? status;
}
