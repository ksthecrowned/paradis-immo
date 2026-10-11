import { apiFetch } from '@/lib/api';

export interface PublicSaleInquiry {
  id: string;
  propertyId: string;
  userId: string;
  message: string | null;
  /** Spec 08 — budget déclaré (XAF) + téléphone de contact. */
  budget?: string | null;
  phone?: string | null;
  status: string;
  createdAt: string;
}

/** Spec 08 — `POST sales/inquiries` (formulaire réel, plus de setTimeout). */
export async function createSaleInquiry(input: {
  propertyId: string;
  message: string;
  budget?: number;
  phone?: string;
}): Promise<PublicSaleInquiry> {
  return apiFetch<PublicSaleInquiry>('/sales/inquiries', {
    method: 'POST',
    body: {
      propertyId: input.propertyId,
      message: input.message,
      ...(input.budget !== undefined ? { budget: input.budget } : {}),
      ...(input.phone ? { phone: input.phone } : {}),
    },
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
  const map: Record<
    string,
    'success' | 'warning' | 'danger' | 'neutral'
  > = {
    NEW: 'warning',
    CONTACTED: 'success',
    VISIT_SCHEDULED: 'success',
    CLOSED: 'neutral',
  };
  return map[status] ?? 'neutral';
}
