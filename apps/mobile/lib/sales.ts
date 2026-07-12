import { apiFetch } from '@/lib/api';

export interface PublicSaleInquiry {
  id: string;
  propertyId: string;
  userId: string;
  message: string | null;
  status: string;
  createdAt: string;
}

export async function createSaleInquiry(
  propertyId: string,
  message?: string,
): Promise<void> {
  await apiFetch('/sales/inquiries', {
    method: 'POST',
    body: { propertyId, ...(message ? { message } : {}) },
  });
}

export async function listMySaleInquiries(): Promise<PublicSaleInquiry[]> {
  return apiFetch<PublicSaleInquiry[]>('/sales/inquiries/my');
}

export function saleInquiryStatusLabel(status: string): string {
  const map: Record<string, string> = {
    NEW: 'Nouvelle',
    CONTACTED: 'Contacté',
    VISIT_SCHEDULED: 'Visite planifiée',
    CLOSED: 'Clôturée',
  };
  return map[status] ?? status;
}

export function saleInquiryStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONTACTED') return 'success';
  if (status === 'NEW') return 'warning';
  if (status === 'CLOSED') return 'neutral';
  return 'neutral';
}
