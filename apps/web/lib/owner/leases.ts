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

export async function listManagedLeases(): Promise<PublicLease[]> {
  return apiFetch<PublicLease[]>('/leases/managed');
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
