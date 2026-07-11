import { apiFetch } from '@/lib/api';

export interface PublicReceipt {
  id: string;
  paymentId: string;
  number: string;
  url: string;
  createdAt: string;
}

export async function getReceipt(id: string): Promise<PublicReceipt> {
  return apiFetch<PublicReceipt>(`/receipts/${id}`);
}

export async function getReceiptForPayment(
  paymentId: string,
): Promise<PublicReceipt> {
  return apiFetch<PublicReceipt>(`/payments/${paymentId}/receipt`);
}
