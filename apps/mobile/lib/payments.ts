import { apiFetch } from '@/lib/api';

export type PaymentMethod = 'CASH' | 'MOBILE_MONEY';
export type MobileProvider = 'AIRTEL' | 'MOMO';

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
  allocations: Array<{
    id: string;
    type: string;
    refId: string;
    amount: string;
    rentScheduleId: string | null;
  }>;
  createdAt: string;
}

export interface InitiatePaymentInput {
  amount: number;
  currency: string;
  method: PaymentMethod;
  provider?: MobileProvider;
  phone?: string;
  idempotencyKey: string;
  rentScheduleId?: string;
  saleInstallmentId?: string;
  visitBookingId?: string;
}

export async function initiatePayment(
  input: InitiatePaymentInput,
): Promise<PublicPayment> {
  return apiFetch<PublicPayment>('/payments', {
    method: 'POST',
    body: input,
  });
}

export async function getPayment(id: string): Promise<PublicPayment> {
  return apiFetch<PublicPayment>(`/payments/${id}`);
}

export async function listMyPayments(): Promise<PublicPayment[]> {
  return apiFetch<PublicPayment[]>('/payments/my');
}

export function paymentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    INITIATED: 'Initié',
    PENDING_VALIDATION: 'En attente de validation',
    VALIDATED: 'Validé',
    FAILED: 'Échoué',
    PENDING: 'En cours',
  };
  return map[status] ?? status;
}

export function paymentStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'VALIDATED') return 'success';
  if (status === 'FAILED') return 'danger';
  if (
    status === 'PENDING_VALIDATION' ||
    status === 'PENDING' ||
    status === 'INITIATED'
  ) {
    return 'warning';
  }
  return 'neutral';
}

export function paymentMethodLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: 'Espèces',
    MOBILE_MONEY: 'Mobile Money',
  };
  return map[method] ?? method;
}
