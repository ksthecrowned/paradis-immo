import { apiFetch } from '@/lib/api';

export type MaintenancePriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type MaintenanceCategory =
  | 'PLUMBING'
  | 'ELECTRICAL'
  | 'LOCKSMITH'
  | 'HVAC'
  | 'PESTS'
  | 'STRUCTURE'
  | 'APPLIANCE'
  | 'GENERATOR'
  | 'WATER_SUPPLY'
  | 'OTHER';

export type PublicMaintenanceTicket = {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  priority: MaintenancePriority;
  status: string;
  createdAt: string;
  updatedAt: string;
  category?: string;
  availability?: string | null;
  entryPermission?: boolean;
  scheduledAt?: string | null;
  resolvedAt?: string | null;
};

export type PublicMaintenanceTicketDetail = PublicMaintenanceTicket & {
  history: Array<{ from: string; to: string; createdAt: string }>;
  comments: Array<{
    id: string;
    authorId: string | null;
    body: string;
    createdAt: string;
  }>;
};

export type MaintenanceTicketPage = {
  data: PublicMaintenanceTicket[];
  meta: { total: number; limit: number; offset: number };
};

export async function createMaintenanceTicket(input: {
  propertyId: string;
  leaseId?: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
  category?: MaintenanceCategory;
  availability?: string;
  entryPermission?: boolean;
}): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>('/maintenance/tickets', {
    method: 'POST',
    body: input,
  });
}

export async function listMyMaintenanceTickets(input: {
  limit: number;
  offset: number;
}): Promise<MaintenanceTicketPage> {
  return apiFetch<MaintenanceTicketPage>(
    `/maintenance/tickets/my?limit=${input.limit}&offset=${input.offset}`,
  );
}

export async function getMaintenanceTicket(
  id: string,
): Promise<PublicMaintenanceTicketDetail> {
  return apiFetch<PublicMaintenanceTicketDetail>(`/maintenance/tickets/${id}`);
}

export async function addMaintenanceComment(
  id: string,
  body: string,
): Promise<void> {
  await apiFetch(`/maintenance/tickets/${id}/comments`, {
    method: 'POST',
    body: { body },
  });
}

export async function transitionMaintenanceTicket(
  id: string,
  input: { to: string; note?: string; cancelReason?: string },
): Promise<PublicMaintenanceTicket> {
  return apiFetch<PublicMaintenanceTicket>(
    `/maintenance/tickets/${id}/transitions`,
    { method: 'POST', body: input },
  );
}

export function canCreateMaintenanceForLease(status: string): boolean {
  return status === 'ACTIVE' || status === 'TERMINATING';
}

export function maintenanceStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    OPEN: 'Ouvert',
    TRIAGED: 'En cours d’analyse',
    AWAITING_QUOTE: 'Devis en attente',
    AWAITING_APPROVAL: 'Approbation en attente',
    ASSIGNED: 'Intervenant affecté',
    SCHEDULED: 'Intervention planifiée',
    IN_PROGRESS: 'Intervention en cours',
    RESOLVED: 'Résolu · à confirmer',
    REOPENED: 'Réouvert',
    CLOSED: 'Clôturé',
    CANCELLED: 'Annulé',
  };
  return labels[status] ?? status;
}
