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
): Promise<PublicOrganizationReview[]> {
  return apiFetch<PublicOrganizationReview[]>(
    `/organizations/${organizationId}/reviews`,
    { anonymous: true },
  );
}

export async function fetchAgencyReviews(
  organizationId: string,
): Promise<AgencyReview[]> {
  const rows = await listOrganizationReviews(organizationId);
  return rows.map(mapOrganizationReview);
}
