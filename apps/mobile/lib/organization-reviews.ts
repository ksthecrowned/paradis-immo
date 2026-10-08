import { apiFetch } from '@/lib/api';
import {
  mapOrganizationReview,
  type PublicOrganizationReview,
} from '@/lib/organization-reviews-map';
import type { AgencyReview } from '@/lib/map-organization';

export type { PublicOrganizationReview } from '@/lib/organization-reviews-map';
export {
  formatReviewCreatedLabel,
  mapOrganizationReview,
} from '@/lib/organization-reviews-map';

export async function listOrganizationReviews(
  organizationId: string,
  page = 1,
  pageSize = 20,
): Promise<PublicOrganizationReview[]> {
  const res = await apiFetch<{
    data: PublicOrganizationReview[];
    meta: { page: number; pageSize: number; total: number; totalPages: number };
  }>(
    `/organizations/${organizationId}/reviews?page=${page}&pageSize=${pageSize}`,
    { anonymous: true },
  );
  return res.data;
}

export async function fetchAgencyReviews(
  organizationId: string,
): Promise<AgencyReview[]> {
  const rows = await listOrganizationReviews(organizationId);
  return rows.map(mapOrganizationReview);
}
