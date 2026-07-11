import { apiFetch } from '@/lib/api';

export interface PublicPayment {
  id: string;
  userId: string;
  amount: string;
  currency: string;
  method: string;
  provider: string | null;
  status: string;
  reference: string;
  idempotencyKey: string;
  validatedBy: string | null;
  validatedAt: string | null;
  createdAt: string;
}

export async function listManagedPayments(): Promise<PublicPayment[]> {
  return apiFetch<PublicPayment[]>('/payments/managed');
}

export function paymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING_VALIDATION: 'En attente validation',
    VALIDATED: 'Validé',
    PENDING: 'En attente',
    FAILED: 'Échoué',
    CANCELLED: 'Annulé',
  };
  return map[status] ?? status;
}

export function paymentStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'VALIDATED') return 'success';
  if (status === 'PENDING_VALIDATION' || status === 'PENDING') return 'warning';
  if (status === 'FAILED' || status === 'CANCELLED') return 'danger';
  return 'neutral';
}
