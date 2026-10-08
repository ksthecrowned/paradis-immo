import { apiFetch } from '@/lib/api';

/** Spec 04 US 8 — révision annuelle du loyer. */
export interface IndexationRecord {
  id: string;
  actionType: 'RENT_INCREASE' | 'RENT_REDUCTION';
  status: string;
  previousMonthlyRent: string | null;
  newMonthlyRent: string | null;
  rate: string | null;
  /** Anniversaire à partir duquel le nouveau loyer s'applique. */
  effectiveFrom: string | null;
  decidedAt: string | null;
  createdAt: string;
  expiresAt: string;
  appliedAt: string | null;
}

/** GET /leases/:id/indexations — propositions de révision du bail. */
export async function listIndexations(
  leaseId: string,
): Promise<IndexationRecord[]> {
  return apiFetch<IndexationRecord[]>(`/leases/${leaseId}/indexations`);
}

export function indexationStatusTone(status: string) {
  if (status === 'APPROVED' || status === 'APPLIED') return 'success' as const;
  if (status === 'REJECTED' || status === 'CANCELLED') return 'danger' as const;
  if (status === 'EXPIRED') return 'neutral' as const;
  return 'warning' as const;
}

export function indexationStatusLabel(status: string) {
  switch (status) {
    case 'PENDING':
      return 'En attente de validation';
    case 'APPROVED':
      return 'Approuvée';
    case 'REJECTED':
      return 'Refusée';
    case 'CANCELLED':
      return 'Annulée';
    case 'EXPIRED':
      return 'Expirée';
    case 'APPLIED':
      return 'Appliquée';
    default:
      return status;
  }
}