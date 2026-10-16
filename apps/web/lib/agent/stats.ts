import { apiFetch } from '@/lib/api';

export interface AgentStats {
  mandatedProperties: number;
  visitsToday: number;
  upcomingVisits: number;
  pendingCashValidations: number;
  openMaintenanceTickets: number;
  activeLeases: number;
  overdueSchedules: number;
  pendingApplications: number;
}

export function fetchAgentStats(): Promise<AgentStats> {
  return apiFetch<AgentStats>('/agent/stats');
}
