import { apiFetch } from '@/lib/api';

export type SolvencyCheckStatus =
  | 'PENDING'
  | 'GRANTED'
  | 'DENIED'
  | 'EXPIRED';

export type SolvencySnapshotItem = {
  dueDate: string;
  paidAt: string;
  amount: string;
  currency: string;
  daysLate: number;
};

export type PublicSolvencyCheck = {
  id: string;
  tenantUserId: string;
  requesterOrgId: string;
  organizationName: string;
  status: SolvencyCheckStatus;
  snapshot: SolvencySnapshotItem[] | null;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export async function getLatestSolvencyCheck(
  tenantId: string,
): Promise<PublicSolvencyCheck | null> {
  return apiFetch<PublicSolvencyCheck | null>(
    `/tenants/${tenantId}/solvency-checks/latest`,
  );
}

export async function requestSolvencyCheck(
  tenantId: string,
): Promise<PublicSolvencyCheck> {
  return apiFetch<PublicSolvencyCheck>(
    `/tenants/${tenantId}/solvency-checks`,
    { method: 'POST' },
  );
}
