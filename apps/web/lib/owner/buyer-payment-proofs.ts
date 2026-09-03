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

export async function getLatestBuyerPaymentProof(
  agreementId: string,
): Promise<PublicBuyerPaymentProof | null> {
  return apiFetch<PublicBuyerPaymentProof | null>(
    `/sale-agreements/${agreementId}/payment-proofs/latest`,
  );
}

export async function requestBuyerPaymentProof(
  agreementId: string,
): Promise<PublicBuyerPaymentProof> {
  return apiFetch<PublicBuyerPaymentProof>(
    `/sale-agreements/${agreementId}/payment-proofs`,
    { method: 'POST' },
  );
}

export type BuyerPaymentProofEligibility = {
  eligible: boolean;
  reason: string | null;
};

export async function getBuyerPaymentProofEligibility(
  agreementId: string,
): Promise<BuyerPaymentProofEligibility> {
  return apiFetch<BuyerPaymentProofEligibility>(
    `/sale-agreements/${agreementId}/payment-proofs/eligibility`,
  );
}

export function proofKindLabel(
  kind: 'RENT' | 'SALE_INSTALLMENT',
): string {
  return kind === 'RENT' ? 'LOYER' : 'PALIER';
}
