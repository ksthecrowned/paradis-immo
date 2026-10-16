import { apiFetch } from '@/lib/api';

export interface AdminStats {
  totalUsers: number;
  suspendedUsers: number;
  totalProperties: number;
  activeProperties: number;
  activeLeases: number;
  totalOrganizations: number;
  overdueSchedules: number;
  pendingRentSchedules: number;
  openReports: number;
  pendingOrgRequests: number;
  pendingKyc: number;
  pendingPaymentValidations: number;
  openDisputes: number;
  failedPayouts: number;
  pendingVisits: number;
}

export async function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>('/admin/stats');
}
