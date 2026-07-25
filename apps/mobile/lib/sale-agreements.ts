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

export async function listMySaleAgreements(): Promise<PublicSaleAgreement[]> {
  return apiFetch<PublicSaleAgreement[]>('/me/sale-agreements');
}

export async function getMySaleAgreement(
  id: string,
): Promise<PublicSaleAgreement> {
  return apiFetch<PublicSaleAgreement>(`/me/sale-agreements/${id}`);
}

export function saleAgreementStatusLabel(status: string): string {
  const map: Record<string, string> = {
    DRAFT: 'Brouillon',
    ACTIVE: 'Actif',
    COMPLETED: 'Terminé',
    CANCELLED: 'Annulé',
  };
  return map[status] ?? status;
}

export function saleInstallmentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'À payer',
    PAID: 'Payé',
    OVERDUE: 'En retard',
    PARTIAL: 'Partiel',
  };
  return map[status] ?? status;
}

export function canPayInstallment(status: string): boolean {
  return status === 'PENDING' || status === 'OVERDUE' || status === 'PARTIAL';
}

export function nextPayableInstallment(
  installments: PublicSaleInstallment[],
): PublicSaleInstallment | undefined {
  const open = installments.filter((i) => canPayInstallment(i.status));
  if (open.length === 0) return undefined;
  return [...open].sort((a, b) => {
    if (a.status === 'OVERDUE' && b.status !== 'OVERDUE') return -1;
    if (b.status === 'OVERDUE' && a.status !== 'OVERDUE') return 1;
    return a.dueDate.localeCompare(b.dueDate) || a.position - b.position;
  })[0];
}
