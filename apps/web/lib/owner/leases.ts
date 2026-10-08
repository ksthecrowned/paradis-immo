import { apiFetch, apiFetchPaginated } from '@/lib/api';

export type LeaseStatus =
  | 'DRAFT'
  | 'PENDING_SIGNATURE'
  | 'ACTIVE'
  | 'TERMINATING'
  | 'TERMINATED'
  | 'CANCELLED';

export interface PublicLease {
  id: string;
  propertyId: string;
  /** Null while the lease only holds an invited phone (no account yet). */
  tenantId: string | null;
  invitedPhone: string | null;
  tenantPhone?: string | null;
  tenantName?: string | null;
  startDate: string;
  endDate: string;
  monthlyRent: string;
  deposit: string;
  currency: string;
  status: LeaseStatus | string;
  dueDay: number;
  chargesAmount: string;
  chargesMode: string;
  noticeMonthsTenant: number;
  noticeMonthsLandlord: number;
  indexationRate: string | null;
  lateFeeAfterDays: number | null;
  lateFeeAmount: string | null;
  lateFeeRate: string | null;
  autoRenew: boolean;
  tenantSignedAt: string | null;
  landlordSignedAt: string | null;
  activatedAt: string | null;
  terminationInitiator: string | null;
  terminationNoticeAt: string | null;
  terminationEffectiveAt: string | null;
  terminationReason: string | null;
  terminatedAt: string | null;
  createdAt: string;
}

export interface PublicRentScheduleEntry {
  id: string;
  leaseId: string;
  dueDate: string;
  amount: string;
  rentPart: string;
  chargesPart: string;
  lateFee: string;
  amountPaid: string;
  currency: string;
  kind: string;
  status: string;
}

export interface CreateLeaseInput {
  propertyId: string;
  /** Phone of the tenant. Unknown numbers are invited, never created. */
  invitedPhone?: string;
  tenantPhone?: string;
  tenantName?: string;
  tenantId?: string;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  deposit: number;
  currency: string;
  dueDay?: number;
  chargesAmount?: number;
  chargesMode?: 'FLAT' | 'PROVISION';
  noticeMonthsTenant?: number;
  noticeMonthsLandlord?: number;
  indexationRate?: number;
  lateFeeAfterDays?: number;
  lateFeeAmount?: number;
  lateFeeRate?: number;
  autoRenew?: boolean;
}

export type UpdateLeaseInput = Partial<
  Omit<CreateLeaseInput, 'propertyId'>
>;

export interface ManagedLeasesFilter {
  status?: LeaseStatus | string;
  propertyId?: string;
  overdue?: boolean;
  page?: number;
  pageSize?: number;
}

/** Masked lookup answer (spec 01) — org members only, never a full name. */
export interface UserLookupResult {
  exists: boolean;
  userId: string | null;
  displayName: string | null;
  phone: string;
}

export async function lookupUserByPhone(
  phone: string,
): Promise<UserLookupResult> {
  return apiFetch<UserLookupResult>(
    `/users/lookup?phone=${encodeURIComponent(phone)}`,
  );
}

export async function listManagedLeases(
  filter: ManagedLeasesFilter = {},
): Promise<{ data: PublicLease[]; meta: { total: number; page: number; pageSize: number; totalPages: number } }> {
  const params = new URLSearchParams();
  if (filter.status) params.set('status', filter.status);
  if (filter.propertyId) params.set('propertyId', filter.propertyId);
  if (filter.overdue) params.set('overdue', 'true');
  if (filter.page) params.set('page', String(filter.page));
  if (filter.pageSize) params.set('pageSize', String(filter.pageSize));
  const qs = params.toString();
  return apiFetchPaginated<PublicLease>(
    `/leases/managed${qs ? `?${qs}` : ''}`,
  );
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

/** DRAFT → PENDING_SIGNATURE, invites the tenant over WhatsApp. */
export async function sendLeaseForSignature(
  id: string,
): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}/send-for-signature`, {
    method: 'POST',
  });
}

export async function cancelLease(id: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}/cancel`, { method: 'POST' });
}

export interface LeaseSignatureState {
  /** The call only asked for a fresh OTP. */
  sent?: boolean;
  /** The call recorded a signature. */
  signed?: boolean;
  /** Both parties signed — the lease moved to ACTIVE. */
  bothSigned: boolean;
  party: 'TENANT' | 'LANDLORD';
}

export type SignedLease = PublicLease & { signature: LeaseSignatureState };

/**
 * Sign a PENDING_SIGNATURE lease by OTP (spec 04). Omit `otpCode` to receive a
 * fresh code over WhatsApp, send it back to record the signature.
 */
export async function signLease(
  id: string,
  otpCode?: string,
): Promise<SignedLease> {
  return apiFetch<SignedLease>(`/leases/${id}/sign`, {
    method: 'POST',
    body: otpCode ? { otpCode } : {},
  });
}

export async function terminateLease(
  id: string,
  input: {
    initiator: 'TENANT' | 'LANDLORD' | 'MUTUAL';
    reason?: string;
    requestedEndDate: string;
  },
): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}/termination`, {
    method: 'POST',
    body: input,
  });
}

export async function withdrawTermination(id: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}/termination`, {
    method: 'DELETE',
    body: {},
  });
}

export async function closeLease(id: string): Promise<PublicLease> {
  return apiFetch<PublicLease>(`/leases/${id}/close`, { method: 'POST' });
}

export async function getLeaseSchedule(
  id: string,
): Promise<PublicRentScheduleEntry[]> {
  return apiFetch<PublicRentScheduleEntry[]>(`/leases/${id}/schedule`);
}

export function leaseStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon',
    PENDING_SIGNATURE: 'En attente de signature',
    ACTIVE: 'Actif',
    TERMINATING: 'En préavis',
    TERMINATED: 'Terminé',
    CANCELLED: 'Annulé',
  };
  return map[status] ?? status;
}

export function leaseStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT' || status === 'PENDING_SIGNATURE') return 'warning';
  if (status === 'TERMINATING') return 'accent';
  if (status === 'CANCELLED' || status === 'TERMINATED') return 'danger';
  return 'neutral';
}

export function rentScheduleStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'À payer',
    PAID: 'Payé',
    OVERDUE: 'En retard',
    PARTIAL: 'Partiel',
    CANCELLED: 'Annulé',
    WAIVED: 'Exonéré',
  };
  return map[status] ?? status;
}

export function rentScheduleStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'danger';
  if (status === 'PENDING' || status === 'PARTIAL') return 'warning';
  if (status === 'CANCELLED') return 'neutral';
  return 'neutral';
}

/** Remaining amount due on a schedule line (spec 04 PARTIAL handling). */
export function scheduleBalance(entry: PublicRentScheduleEntry): number {
  return Number(entry.amount) - Number(entry.amountPaid);
}

/** Spec 04 US 7 — colocataires assis sur le bail. */
export interface PublicCoTenant {
  userId: string;
  name: string | null;
  phone: string | null;
  isPrimary: boolean;
}

export async function listCoTenants(
  leaseId: string,
): Promise<PublicCoTenant[]> {
  return apiFetch<PublicCoTenant[]>(`/leases/${leaseId}/co-tenants`);
}

/** Spec 04 US 11 — renouvellement : nouveau terme, loyer du nouveau terme. */
export interface LeaseRenewalResult {
  /** False while a live mandate waits for the owner's approval. */
  applied: boolean;
  approvalId: string | null;
  lease: PublicLease;
}

export async function renewLease(
  leaseId: string,
  input: { newEndDate: string; newMonthlyRent?: number },
): Promise<LeaseRenewalResult> {
  return apiFetch<LeaseRenewalResult>(`/leases/${leaseId}/renew`, {
    method: 'POST',
    body: input,
  });
}