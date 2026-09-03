import { apiFetch } from '@/lib/api';

export type BuyerPaymentProofStatus =
  | 'PENDING'
  | 'GRANTED'
  | 'DENIED'
  | 'EXPIRED';

export type BuyerPaymentProofSnapshotItem = {
  kind: 'RENT' | 'SALE_INSTALLMENT';
  dueDate: string;
  paidAt: string;
  amount: string;
  currency: string;
  daysLate: number;
};

export type PublicBuyerPaymentProof = {
  id: string;
  saleAgreementId: string;
  buyerUserId: string;
  requesterOrgId: string;
  organizationName: string;
  status: BuyerPaymentProofStatus;
  snapshot: BuyerPaymentProofSnapshotItem[] | null;
  respondedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export async function listMyBuyerPaymentProofs(): Promise<
  PublicBuyerPaymentProof[]
> {
  return apiFetch<PublicBuyerPaymentProof[]>('/me/buyer-payment-proofs');
}

export async function respondBuyerPaymentProof(
  id: string,
  accept: boolean,
): Promise<PublicBuyerPaymentProof> {
  return apiFetch<PublicBuyerPaymentProof>(
    `/me/buyer-payment-proofs/${id}/respond`,
    {
      method: 'POST',
      body: { accept },
    },
  );
}
