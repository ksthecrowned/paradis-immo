import { apiFetchPaginated } from '@/lib/api';
import type { PaginatedListQuery, PaginatedResult } from '@/lib/http/types';
import type { RentalApplication } from '@/lib/owner/applications';

export type ManagedApplicationsQuery = PaginatedListQuery & {
  status?: string;
};

/**
 * Candidatures for one property, in the shape `PaginatedDataTable` expects
 * (spec 04 — `GET /properties/:id/applications`).
 */
export async function fetchPropertyApplications(
  propertyId: string,
  params: ManagedApplicationsQuery &
    Required<Pick<PaginatedListQuery, 'page' | 'limit'>>,
): Promise<PaginatedResult<RentalApplication>> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.limit),
  });
  if (params.status) search.set('status', params.status);
  const result = await apiFetchPaginated<RentalApplication>(
    `/properties/${propertyId}/applications?${search.toString()}`,
  );
  return {
    data: result.data,
    meta: {
      total: result.meta.total,
      page: result.meta.page,
      pageSize: result.meta.pageSize,
      totalPages: result.meta.totalPages,
    },
  };
}