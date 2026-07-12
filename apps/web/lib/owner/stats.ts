import { apiFetch } from '@/lib/api';

export interface OwnerStats {
  activeProperties: number;
  activeLeases: number;
  pendingPayments: number;
  pendingVisitRequests: number;
}

export function fetchOwnerStats(): Promise<OwnerStats> {
  return apiFetch<OwnerStats>('/owner/stats');
}
