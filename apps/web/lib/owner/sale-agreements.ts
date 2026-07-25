import { apiFetch } from '@/lib/api';

export type SaleAgreementStatus =
  | 'DRAFT'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'CANCELLED';

export type SaleInstallmentStatus =
  | 'PENDING'
  | 'PAID'
  | 'OVERDUE'
  | 'PARTIAL';

export type PublicSaleInstallment = {
  id: string;
  label: string | null;
  dueDate: string;
  amount: string;
  currency: string;
  status: SaleInstallmentStatus;
  position: number;
};

export type PublicSaleAgreement = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  buyerId: string;
  buyerName: string | null;
  buyerPhone: string | null;
  organizationId: string;
  saleInquiryId: string | null;
  agreedPrice: string;
  currency: string;
  status: SaleAgreementStatus;
  installments: PublicSaleInstallment[];
  activatedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SaleInstallmentInput = {
  label?: string;
  dueDate: string;
  amount: number;
};

export type CreateSaleAgreementInput = {
  propertyId: string;
  buyerPhone?: string;
  buyerName?: string;
  saleInquiryId?: string;
  agreedPrice: number;
  currency: string;
  installments: SaleInstallmentInput[];
};

export function saleAgreementStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon',
    ACTIVE: 'Actif',
    COMPLETED: 'Terminé',
    CANCELLED: 'Annulé',
  };
  return map[status] ?? status;
}

export function saleAgreementStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' | 'accent' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'DRAFT') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  if (status === 'COMPLETED') return 'accent';
  return 'neutral';
}

export async function listSaleAgreements(): Promise<PublicSaleAgreement[]> {
  return apiFetch<PublicSaleAgreement[]>('/sale-agreements');
}

export async function getSaleAgreement(
  id: string,
): Promise<PublicSaleAgreement> {
  return apiFetch<PublicSaleAgreement>(`/sale-agreements/${id}`);
}

export async function createSaleAgreement(
  input: CreateSaleAgreementInput,
): Promise<PublicSaleAgreement> {
  return apiFetch<PublicSaleAgreement>('/sale-agreements', {
    method: 'POST',
    body: input,
  });
}

export async function activateSaleAgreement(
  id: string,
): Promise<PublicSaleAgreement> {
  return apiFetch<PublicSaleAgreement>(`/sale-agreements/${id}/activate`, {
    method: 'POST',
  });
}

export async function completeSaleAgreement(
  id: string,
): Promise<PublicSaleAgreement> {
  return apiFetch<PublicSaleAgreement>(`/sale-agreements/${id}/complete`, {
    method: 'POST',
  });
}

export async function cancelSaleAgreement(
  id: string,
): Promise<PublicSaleAgreement> {
  return apiFetch<PublicSaleAgreement>(`/sale-agreements/${id}/cancel`, {
    method: 'POST',
  });
}
