import { apiFetch } from '@/lib/api';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export type PublicMaintenanceTicket = {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: string;
  createdAt: string;
};

export async function createMaintenanceTicket(input: {
  propertyId: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
}): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>('/maintenance/tickets', {
    method: 'POST',
    body: input,
  });
}

export function canCreateMaintenanceForLease(status: string): boolean {
  return status === 'ACTIVE';
}
