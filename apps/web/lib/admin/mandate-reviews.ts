import { apiFetch } from '@/lib/api';

export type MandateReviewRow = {
  id: string;
  status: string;
  documentReviewStatus: string;
  documentVersion: number;
  signedDocumentKey: string | null;
  createdAt: string;
  propertyId: string;
  organizationId: string;
  property: { id: string; title: string; status: string };
  organization: { id: string; name: string };
};

export async function listMandateReviews(
  page = 1,
  pageSize = 20,
): Promise<{
  data: MandateReviewRow[];
  meta: { total: number; page: number; pageSize: number };
}> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(pageSize),
  });
  return apiFetch(`/admin/mandate-reviews?${params}`);
}

export async function decideMandateReview(
  mandateId: string,
  decision: 'APPROVED' | 'NEEDS_CORRECTION' | 'REJECTED',
  reason: string,
): Promise<unknown> {
  return apiFetch(`/admin/mandate-reviews/${encodeURIComponent(mandateId)}/decide`, {
    method: 'POST',
    body: { decision, reason },
  });
}
