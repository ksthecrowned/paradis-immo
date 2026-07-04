import { apiFetchPaginated } from '@/lib/api';
import type { PaginatedListQuery, PaginatedResult } from '@/lib/http/types';

export interface AdminUser {
  id: string;
  phone: string;
  name: string | null;
  countryId: string;
  roles: string[];
  createdAt: string;
}

export async function listUsers(
  params: PaginatedListQuery & Required<Pick<PaginatedListQuery, 'page' | 'limit'>>,
): Promise<PaginatedResult<AdminUser>> {
  const search = new URLSearchParams({
    page: String(params.page),
    pageSize: String(params.limit),
  });
  const result = await apiFetchPaginated<AdminUser>(`/admin/users?${search}`);

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
