import { apiFetch } from '@/lib/api';

export type DepositDeductionStatus = 'PROPOSED' | 'CONTESTED' | 'ACCEPTED';

export interface PublicDepositDeduction {
  id: string;
  leaseId: string;
  label: string;
  amount: string;
  evidenceItemId: string | null;
  evidenceKeys: string[];
  status: DepositDeductionStatus | string;
  tenantComment: string | null;
  createdAt: string;
  /** Last day the tenant can contest it (15 days after the proposal). */
  contestableUntil: string;
  contestable: boolean;
}

export interface PublicDepositSettlement {
  id: string;
  leaseId: string;
  heldAmount: string;
  deducted: string;
  refundAmount: string;
  contestUntil: string;
  payoutId: string | null;
  settledAt: string | null;
}

export interface PublicDepositSummary {
  leaseId: string;
  leaseStatus: string;
  currency: string;
  depositAmount: string;
  heldAmount: string;
  schedule: {
    id: string;
    dueDate: string;
    amount: string;
    amountPaid: string;
    status: string;
  } | null;
  deductions: PublicDepositDeduction[];
  deductedTotal: string;
  openTotal: string;
  settlement: PublicDepositSettlement | null;
  refundDeadline: string | null;
}

export interface CreateDeductionInput {
  label: string;
  amount: number;
  evidenceItemId?: string;
  evidenceKeys?: string[];
}

export async function getLeaseDeposit(
  leaseId: string,
): Promise<PublicDepositSummary> {
  return apiFetch<PublicDepositSummary>(`/leases/${leaseId}/deposit`);
}

export async function proposeDeduction(
  leaseId: string,
  input: CreateDeductionInput,
): Promise<PublicDepositDeduction> {
  return apiFetch<PublicDepositDeduction>(
    `/leases/${leaseId}/deposit/deductions`,
    { method: 'POST', body: input },
  );
}

/** Tenant contests (`CONTESTED`) or manager accepts (`ACCEPTED`). */
export async function updateDeduction(
  deductionId: string,
  input: { status: DepositDeductionStatus; tenantComment?: string },
): Promise<PublicDepositDeduction> {
  return apiFetch<PublicDepositDeduction>(`/deposit-deductions/${deductionId}`, {
    method: 'PATCH',
    body: input,
  });
}

export async function settleDeposit(
  leaseId: string,
  input: { currency?: string; method?: 'CASH' | 'BANK_TRANSFER'; note?: string } = {},
): Promise<PublicDepositSummary> {
  return apiFetch<PublicDepositSummary>(`/leases/${leaseId}/deposit/settle`, {
    method: 'POST',
    body: input,
  });
}

export function deductionStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PROPOSED: 'Proposée',
    CONTESTED: 'Contestée',
    ACCEPTED: 'Acceptée',
  };
  return map[status] ?? status;
}

export function deductionStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACCEPTED') return 'danger';
  if (status === 'CONTESTED') return 'warning';
  if (status === 'PROPOSED') return 'neutral';
  return 'neutral';
}
