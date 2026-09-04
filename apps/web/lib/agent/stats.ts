import { apiFetch } from '@/lib/api';

export interface AgentStats {
  mandatedProperties: number;
  visitsToday: number;
  pendingCashValidations: number;
  openMaintenanceTickets: number;
}

export function fetchAgentStats(): Promise<AgentStats> {
  return apiFetch<AgentStats>('/agent/stats');
}
