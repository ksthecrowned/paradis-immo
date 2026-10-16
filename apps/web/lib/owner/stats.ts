import { apiFetch } from '@/lib/api';

export interface OwnerStats {
  activeProperties: number;
  draftProperties: number;
  activeLeases: number;
  pendingPayments: number;
  overdueSchedules: number;
  pendingVisitRequests: number;
  openMaintenanceTickets: number;
  pendingApplications: number;
}

export function fetchOwnerStats(): Promise<OwnerStats> {
  return apiFetch<OwnerStats>('/owner/stats');
}
