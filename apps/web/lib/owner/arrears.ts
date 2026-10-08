import { apiFetch, apiFetchPaginated } from '@/lib/api';

export interface ArrearsBuckets {
  d0_30: string;
  d31_60: string;
  d60plus: string;
}

export interface ArrearsRow {
  leaseId: string;
  propertyId: string;
  propertyTitle: string;
  tenantId: string | null;
  tenantName: string | null;
  tenantPhone: string | null;
  currency: string;
  overdueAmount: string;
  overdueCount: number;
  oldestDueDate: string | null;
  maxDaysOverdue: number;
  buckets: ArrearsBuckets;
  counts: { d0_30: number; d31_60: number; d60plus: number };
}

export interface ArrearsSummary {
  leaseCount: number;
  totalOverdueByCurrency: Record<string, string>;
  buckets: Record<string, ArrearsBuckets>;
  currency: string;
}

export interface LeaseBalanceLine {
  id: string;
  dueDate: string;
  kind: string;
  amount: string;
  amountPaid: string;
  balance: string;
  status: string;
  daysOverdue: number;
}

export interface LeaseBalance {
  leaseId: string;
  leaseStatus: string;
  currency: string;
  depositHeld: string;
  totalDue: string;
  totalPaid: string;
  balance: string;
  overdueAmount: string;
  overdueCount: number;
  nextDueDate: string | null;
  nextDueAmount: string | null;
  lines: LeaseBalanceLine[];
}

export type ArrearsBucketFilter = '0-30' | '31-60' | '60+';

export interface ArrearsFilter {
  propertyId?: string;
  bucket?: ArrearsBucketFilter;
  page?: number;
  pageSize?: number;
}

export async function listArrears(
  filter: ArrearsFilter = {},
): Promise<{
  data: ArrearsRow[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}> {
  const params = new URLSearchParams();
  if (filter.propertyId) params.set('propertyId', filter.propertyId);
  if (filter.bucket) params.set('bucket', filter.bucket);
  if (filter.page) params.set('page', String(filter.page));
  if (filter.pageSize) params.set('pageSize', String(filter.pageSize));
  const qs = params.toString();
  return apiFetchPaginated<ArrearsRow>(`/leases/arrears${qs ? `?${qs}` : ''}`);
}

export async function getArrearsSummary(): Promise<ArrearsSummary> {
  return apiFetch<ArrearsSummary>('/leases/arrears/summary');
}

export async function getLeaseBalance(leaseId: string): Promise<LeaseBalance> {
  return apiFetch<LeaseBalance>(`/leases/${leaseId}/balance`);
}

/** Manual dunning message (spec 04 US 20). */
export async function sendLeaseReminder(
  leaseId: string,
  input: { channel?: 'WHATSAPP' | 'PUSH'; message?: string } = {},
): Promise<{
  sent: boolean;
  channel: string;
  amount: string;
  currency: string;
  overdueCount: number;
  message: string;
}> {
  return apiFetch(`/leases/${leaseId}/reminders`, {
    method: 'POST',
    body: input,
  });
}

export function formatMoneyWeb(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

/** Bucket label + amount for a row cell. */
export function bucketLabel(key: keyof ArrearsBuckets): string {
  if (key === 'd0_30') return '0-30 j';
  if (key === 'd31_60') return '31-60 j';
  return '+60 j';
}
