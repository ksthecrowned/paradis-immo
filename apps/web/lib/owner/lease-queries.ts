import { apiFetchPaginated } from '@/lib/api';
import type { PaginatedListQuery, PaginatedResult } from '@/lib/http/types';
import type { PublicLease } from '@/lib/owner/leases';

export type ManagedLeasesQuery = PaginatedListQuery & {
  status?: string;
  propertyId?: string;
  overdue?: boolean;
};

/** `PaginatedDataTable`-compatible managed lease query (spec 04). */
export async function fetchManagedLeases(
  params: ManagedLeasesQuery &
    Required<Pick<PaginatedListQuery, 'page' | 'limit'>>,
): Promise<PaginatedResult<PublicLease>> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.limit),
  });
  if (params.status) search.set('status', params.status);
  if (params.propertyId) search.set('propertyId', params.propertyId);
  if (params.overdue) search.set('overdue', 'true');
  const result = await apiFetchPaginated<PublicLease>(
    `/leases/managed?${search.toString()}`,
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