import { apiFetch } from '@/lib/api';

export interface PublicPaymentAllocation {
  id: string;
  type: string;
  refId: string;
  amount: string;
  rentScheduleId: string | null;
}

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
  allocations?: PublicPaymentAllocation[];
  createdAt: string;
}

export interface PublicPaymentReceipt {
  id: string;
  paymentId: string;
  number: string;
  url: string;
  createdAt: string;
}

export async function listManagedPayments(): Promise<PublicPayment[]> {
  return apiFetch<PublicPayment[]>('/payments/managed');
}

export async function getPayment(id: string): Promise<PublicPayment> {
  return apiFetch<PublicPayment>(`/payments/${id}`);
}

export async function validatePayment(
  id: string,
  allocations: Array<{
    type: 'RENT_SCHEDULE' | 'BOOKING' | 'VISIT_BOOKING' | 'SALE_INSTALLMENT';
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

export type RecordCashPaymentInput = {
  rentScheduleId?: string;
  saleInstallmentId?: string;
  amount?: number;
  currency?: string;
  note?: string;
  idempotencyKey?: string;
};

export async function recordCashPayment(
  input: RecordCashPaymentInput,
): Promise<PublicPayment> {
  if (!input.rentScheduleId && !input.saleInstallmentId) {
    throw new Error('rentScheduleId or saleInstallmentId is required');
  }
  const targetKey = input.rentScheduleId
    ? `cash-rent-${input.rentScheduleId}`
    : `cash-sale-${input.saleInstallmentId}`;
  return apiFetch<PublicPayment>('/payments/record-cash', {
    method: 'POST',
    body: {
      ...(input.rentScheduleId
        ? { rentScheduleId: input.rentScheduleId }
        : {}),
      ...(input.saleInstallmentId
        ? { saleInstallmentId: input.saleInstallmentId }
        : {}),
      ...(input.amount != null ? { amount: input.amount } : {}),
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.note ? { note: input.note } : {}),
      idempotencyKey: input.idempotencyKey ?? `${targetKey}-${Date.now()}`,
    },
  });
}

export async function getPaymentReceipt(
  paymentId: string,
): Promise<PublicPaymentReceipt> {
  return apiFetch<PublicPaymentReceipt>(`/payments/${paymentId}/receipt`);
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
