import { apiFetch, apiFetchPaginated } from '@/lib/api';
import type { PaginatedListQuery, PaginatedResult } from '@/lib/http/types';

export interface AdminUser {
  id: string;
  phone: string | null;
  name: string | null;
  avatarUrl: string | null;
  countryName: string;
  status: 'ACTIVE' | 'SUSPENDED' | 'DELETED';
  roles: string[];
  createdAt: string;
}

export interface AdminUserDetail extends AdminUser {
  email: string | null;
  kycStatus: string;
  suspendedAt: string | null;
  suspendedReason: string | null;
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

export function getAdminUser(id: string): Promise<AdminUserDetail> {
  return apiFetch<AdminUserDetail>(`/admin/users/${encodeURIComponent(id)}`);
}

export async function suspendUser(
  id: string,
  reason: string,
): Promise<void> {
  await apiFetch(`/admin/users/${id}/suspend`, {
    method: 'PATCH',
    body: { reason },
  });
}

export async function unsuspendUser(id: string): Promise<void> {
  await apiFetch(`/admin/users/${id}/unsuspend`, { method: 'PATCH' });
}
