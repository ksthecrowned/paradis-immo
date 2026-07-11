import { apiFetch } from '@/lib/api';

export type SaleInquiryStatus =
  | 'NEW'
  | 'CONTACTED'
  | 'VISIT_SCHEDULED'
  | 'CLOSED';

export interface PublicSaleInquiry {
  id: string;
  propertyId: string;
  userId: string;
  message: string | null;
  status: SaleInquiryStatus;
  createdAt: string;
  updatedAt: string;
}

export async function listManagedInquiries(): Promise<PublicSaleInquiry[]> {
  return apiFetch<PublicSaleInquiry[]>('/sales/inquiries/managed');
}

export async function updateInquiryStatus(
  id: string,
  newStatus: SaleInquiryStatus,
): Promise<PublicSaleInquiry> {
  return apiFetch<PublicSaleInquiry>(`/sales/inquiries/${id}/status`, {
    method: 'PATCH',
    body: { newStatus },
  });
}

export function saleStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: 'Nouveau',
    CONTACTED: 'Contacté',
    VISIT_SCHEDULED: 'Visite planifiée',
    CLOSED: 'Clôturé',
  };
  return map[status] ?? status;
}

export function saleStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'NEW') return 'warning';
  if (status === 'CONTACTED' || status === 'VISIT_SCHEDULED') return 'neutral';
  if (status === 'CLOSED') return 'success';
  return 'neutral';
}
