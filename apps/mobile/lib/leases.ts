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

/** UI-facing rent line (API schedule + display fields). */
export type RentLineView = {
  id: string;
  leaseId: string;
  label: string;
  dueDate: string;
  amount: number;
  status: string;
  currency: string;
};

export function rentLineLabelFromDue(dueDate: string): string {
  const day = dueDate.slice(0, 10);
  const [y, m] = day.split('-').map(Number);
  const date = new Date(y!, m! - 1, 1);
  const raw = new Intl.DateTimeFormat('fr-FR', {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function mapScheduleEntry(
  entry: PublicRentScheduleEntry,
): RentLineView {
  return {
    id: entry.id,
    leaseId: entry.leaseId,
    label: rentLineLabelFromDue(entry.dueDate),
    dueDate: entry.dueDate.slice(0, 10),
    amount: Number(entry.amount),
    status: entry.status,
    currency: entry.currency,
  };
}

/** Next payable line: OVERDUE first, then earliest PENDING. */
export function nextPendingDue(
  schedule: RentLineView[],
): RentLineView | undefined {
  const open = schedule.filter(
    (l) => l.status === 'PENDING' || l.status === 'OVERDUE',
  );
  if (open.length === 0) return undefined;
  return [...open].sort((a, b) => {
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
    if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
    return a.dueDate.localeCompare(b.dueDate);
  })[0];
}

export function canPayRentLine(status: string): boolean {
  return status === 'PENDING' || status === 'OVERDUE';
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

export function rentScheduleStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'neutral';
}
