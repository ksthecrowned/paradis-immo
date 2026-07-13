import { apiFetch } from '@/lib/api';

export interface PublicMaintenanceTicket {
  id: string;
  propertyId: string;
  reporterId: string;
  assigneeId: string | null;
  title: string;
  description: string;
  priority: string;
  status: string;
  estimatedCost: string | null;
  requiresOwnerApproval: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listManagedMaintenance(): Promise<
  PublicMaintenanceTicket[]
> {
  return apiFetch<PublicMaintenanceTicket[]>('/maintenance/tickets/managed');
}

export async function getMaintenanceTicket(
  id: string,
): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>(`/maintenance/tickets/${id}`);
}

export interface CreateMaintenanceTicketInput {
  propertyId: string;
  title: string;
  description: string;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  estimatedCost?: number;
}

export async function createMaintenanceTicket(
  body: CreateMaintenanceTicketInput,
): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>('/maintenance/tickets', {
    method: 'POST',
    body,
  });
}

export async function updateMaintenanceTicket(
  id: string,
  body: { status?: string; estimatedCost?: number },
): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>(`/maintenance/tickets/${id}`, {
    method: 'PATCH',
    body,
  });
}

export async function assignMaintenanceTicket(
  id: string,
  assigneeId: string,
): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>(
    `/maintenance/tickets/${id}/assign`,
    {
      method: 'PATCH',
      body: { assigneeId },
    },
  );
}

export function maintenanceStatusLabel(status: string): string {
  const map: Record<string, string> = {
    OPEN: 'Ouvert',
    ASSIGNED: 'Assigné',
    IN_PROGRESS: 'En cours',
    DONE: 'Terminé',
    CLOSED: 'Fermé',
  };
  return map[status] ?? status;
}

export function maintenanceStatusTone(
  status: string,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'DONE' || status === 'CLOSED') return 'success';
  if (status === 'OPEN') return 'warning';
  if (status === 'IN_PROGRESS' || status === 'ASSIGNED') return 'neutral';
  return 'neutral';
}

export function maintenancePriorityLabel(priority: string): string {
  const map: Record<string, string> = {
    LOW: 'Basse',
    MEDIUM: 'Moyenne',
    HIGH: 'Haute',
    URGENT: 'Urgente',
  };
  return map[priority] ?? priority;
}
