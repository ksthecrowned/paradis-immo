import { apiFetch } from '@/lib/api';

export interface AdminStats {
  totalUsers: number;
  totalProperties: number;
  activeLeases: number;
  overdueSchedules: number;
  pendingRentSchedules: number;
  totalOrganizations: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats');
}
