import { apiFetch } from '@/lib/api';
export {
  getLeaseDeposit,
  proposeDeduction,
  settleDeposit,
  updateDeduction,
  deductionStatusLabel,
  deductionStatusTone,
} from '@/lib/owner/deposits';
export type {
  PublicDepositDeduction,
  PublicDepositSettlement,
  PublicDepositSummary,
} from '@/lib/owner/deposits';
import {
  listManagedLeases,
  type CreateLeaseInput,
  type LeaseStatus,
  type ManagedLeasesFilter,
  type PublicLease,
  type UpdateLeaseInput,
} from '@/lib/owner/leases';

export type {
  CreateLeaseInput,
  LeaseStatus,
  PublicLease,
  UpdateLeaseInput,
};
export {
  activateLease,
  cancelLease,
  closeLease,
  leaseStatusLabel,
  leaseStatusTone,
  rentScheduleStatusLabel,
  rentScheduleStatusTone,
  scheduleBalance,
  sendLeaseForSignature,
  signLease,
  terminateLease,
  withdrawTermination,
} from '@/lib/owner/leases';

/** Paginated managed leases (spec 04). */
export async function listManagedLeasesPage(
  filter: ManagedLeasesFilter = {},
): Promise<{
  data: PublicLease[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}> {
  return listManagedLeases(filter);
}

export async function requestLeaseSign(leaseId: string): Promise<{
  id: string;
  status: string;
}> {
  return apiFetch(`/leases/${leaseId}/request-sign`, { method: 'POST' });
}