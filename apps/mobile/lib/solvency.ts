import { apiFetch } from '@/lib/api';

export type SolvencyCheckStatus =
  | 'PENDING'
  | 'GRANTED'
  | 'DENIED'
  | 'EXPIRED';

export type PublicSolvencyCheck = {
  id: string;
  tenantUserId: string;
  requesterOrgId: string;
  organizationName: string;
  status: SolvencyCheckStatus;
  snapshot: unknown;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export async function listMySolvencyChecks(): Promise<PublicSolvencyCheck[]> {
  return apiFetch<PublicSolvencyCheck[]>('/me/solvency-checks');
}

export async function respondSolvencyCheck(
  id: string,
  accept: boolean,
): Promise<PublicSolvencyCheck> {
  return apiFetch<PublicSolvencyCheck>(`/me/solvency-checks/${id}/respond`, {
    method: 'POST',
    body: { accept },
  });
}
