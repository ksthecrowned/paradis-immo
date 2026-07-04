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
  validatedBy: string | null;
  validatedAt: string | null;
  createdAt: string;
}

export async function listPendingValidationPayments(): Promise<PublicPayment[]> {
  return apiFetch<PublicPayment[]>('/payments/pending-validation');
}

export async function validatePayment(
  id: string,
  allocations: Array<{
    type: 'RENT_SCHEDULE' | 'BOOKING' | 'VISIT_BOOKING';
    refId: string;
    amount: string | number;
    rentScheduleId?: string;
  }> = [],
): Promise<PublicPayment> {
  return apiFetch<PublicPayment>(`/payments/${id}/validate`, {
    method: 'POST',
    body: { allocations },
  });
}
