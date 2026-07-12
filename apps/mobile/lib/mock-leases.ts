import type { StatusTone } from '@/components/ui/StatusBadge';

function formatFcfa(amount: number): string {
  return `${amount.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

export type LeaseStatus = 'ACTIVE' | 'TERMINATED';
export type RentLineStatus = 'PENDING' | 'PAID' | 'OVERDUE';
export type MaintenanceStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED';
export type MaintenanceUrgency = 'LOW' | 'NORMAL' | 'HIGH';

export type MockLease = {
  id: string;
  propertyId: string;
  status: LeaseStatus;
  startDate: string;
  endDate?: string;
  monthlyRent: number;
  deposit: number;
  currency: 'FCFA';
  agencyId: string;
  agentId: string;
};

export type MockRentScheduleEntry = {
  id: string;
  leaseId: string;
  label: string;
  dueDate: string;
  amount: number;
  status: RentLineStatus;
  paymentSessionId?: string;
};

export type MockMaintenanceTicket = {
  id: string;
  leaseId: string;
  title: string;
  description: string;
  urgency: MaintenanceUrgency;
  status: MaintenanceStatus;
  createdAt: string;
};

const LEASES: MockLease[] = [
  {
    id: 'lease-1',
    propertyId: '2',
    status: 'ACTIVE',
    startDate: '2026-01-01',
    monthlyRent: 100_000,
    deposit: 200_000,
    currency: 'FCFA',
    agencyId: 'ag-habitat-pn',
    agentId: 'ag-habitat-pn-1',
  },
  {
    id: 'lease-3',
    propertyId: '3',
    status: 'ACTIVE',
    startDate: '2025-09-01',
    monthlyRent: 45_000,
    deposit: 90_000,
    currency: 'FCFA',
    agencyId: 'ag-cote-sauvage',
    agentId: 'ag-cote-sauvage-2',
  },
  {
    id: 'lease-2',
    propertyId: '1',
    status: 'TERMINATED',
    startDate: '2024-06-01',
    endDate: '2025-12-31',
    monthlyRent: 250_000,
    deposit: 500_000,
    currency: 'FCFA',
    agencyId: 'ag-paradis-immo',
    agentId: 'ag-paradis-immo-1',
  },
];

const SCHEDULE: MockRentScheduleEntry[] = [
  {
    id: 'rent-1-may',
    leaseId: 'lease-1',
    label: 'Mai 2026',
    dueDate: '2026-05-05',
    amount: 100_000,
    status: 'OVERDUE',
    paymentSessionId: 'pay-rent-may',
  },
  {
    id: 'rent-1-jun',
    leaseId: 'lease-1',
    label: 'Juin 2026',
    dueDate: '2026-06-05',
    amount: 100_000,
    status: 'PAID',
  },
  {
    id: 'rent-1-jul',
    leaseId: 'lease-1',
    label: 'Juillet 2026',
    dueDate: '2026-07-05',
    amount: 100_000,
    status: 'PENDING',
    paymentSessionId: 'pay-rent-jul',
  },
  {
    id: 'rent-3-jun',
    leaseId: 'lease-3',
    label: 'Juin 2026',
    dueDate: '2026-06-05',
    amount: 45_000,
    status: 'PAID',
  },
  {
    id: 'rent-3-jul',
    leaseId: 'lease-3',
    label: 'Juillet 2026',
    dueDate: '2026-07-05',
    amount: 45_000,
    status: 'PENDING',
    paymentSessionId: 'pay-rent-lease3-jul',
  },
  {
    id: 'rent-2-dec',
    leaseId: 'lease-2',
    label: 'Décembre 2025',
    dueDate: '2025-12-05',
    amount: 250_000,
    status: 'PAID',
  },
  {
    id: 'rent-2-nov',
    leaseId: 'lease-2',
    label: 'Novembre 2025',
    dueDate: '2025-11-05',
    amount: 250_000,
    status: 'PAID',
  },
];

const tickets: MockMaintenanceTicket[] = [
  {
    id: 'mt-1',
    leaseId: 'lease-1',
    title: 'Clim salon en panne',
    description: 'La climatisation du salon ne démarre plus depuis lundi.',
    urgency: 'HIGH',
    status: 'OPEN',
    createdAt: '2026-07-08T10:00:00.000Z',
  },
  {
    id: 'mt-2',
    leaseId: 'lease-1',
    title: 'Robinet cuisine',
    description: 'Fuite légère sous l’évier — réparé par le plombier.',
    urgency: 'NORMAL',
    status: 'RESOLVED',
    createdAt: '2026-06-20T09:00:00.000Z',
  },
  {
    id: 'mt-3',
    leaseId: 'lease-1',
    title: 'Interphone',
    description: 'L’interphone de l’immeuble est défectueux.',
    urgency: 'LOW',
    status: 'IN_PROGRESS',
    createdAt: '2026-07-01T14:30:00.000Z',
  },
];

export function listMockLeases(): MockLease[] {
  return [...LEASES];
}

export function listActiveLeases(): MockLease[] {
  return listMockLeases()
    .filter((lease) => lease.status === 'ACTIVE')
    .sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function getPrimaryActiveLease(): MockLease | undefined {
  return listActiveLeases()[0];
}

export function getMockLease(id: string): MockLease | undefined {
  return LEASES.find((lease) => lease.id === id);
}

export function listScheduleForLease(leaseId: string): MockRentScheduleEntry[] {
  return SCHEDULE.filter((line) => line.leaseId === leaseId).sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  );
}

export function nextDueForLease(
  leaseId: string,
): MockRentScheduleEntry | undefined {
  const lines = listScheduleForLease(leaseId);
  const overdue = lines.find((line) => line.status === 'OVERDUE');
  if (overdue) return overdue;
  return lines.find((line) => line.status === 'PENDING');
}

export function listTicketsForLease(leaseId: string): MockMaintenanceTicket[] {
  return tickets.filter((ticket) => ticket.leaseId === leaseId);
}

export function addMaintenanceTicket(input: {
  leaseId: string;
  title: string;
  description: string;
  urgency: MaintenanceUrgency;
}): MockMaintenanceTicket {
  const ticket: MockMaintenanceTicket = {
    id: `mt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    leaseId: input.leaseId,
    title: input.title.trim(),
    description: input.description.trim(),
    urgency: input.urgency,
    status: 'OPEN',
    createdAt: new Date().toISOString(),
  };
  tickets.unshift(ticket);
  return ticket;
}

export function leaseStatusLabel(status: LeaseStatus): string {
  return status === 'ACTIVE' ? 'Actif' : 'Terminé';
}

export function rentLineStatusLabel(status: RentLineStatus): string {
  const map: Record<RentLineStatus, string> = {
    PENDING: 'À payer',
    PAID: 'Payé',
    OVERDUE: 'En retard',
  };
  return map[status];
}

export function maintenanceStatusLabel(status: MaintenanceStatus): string {
  const map: Record<MaintenanceStatus, string> = {
    OPEN: 'Ouvert',
    IN_PROGRESS: 'En cours',
    RESOLVED: 'Résolu',
  };
  return map[status];
}

export function maintenanceUrgencyLabel(urgency: MaintenanceUrgency): string {
  const map: Record<MaintenanceUrgency, string> = {
    LOW: 'Basse',
    NORMAL: 'Normale',
    HIGH: 'Haute',
  };
  return map[urgency];
}

export function leaseStatusTone(status: LeaseStatus): StatusTone {
  return status === 'ACTIVE' ? 'success' : 'neutral';
}

export function rentLineStatusTone(status: RentLineStatus): StatusTone {
  if (status === 'PAID') return 'success';
  if (status === 'OVERDUE') return 'danger';
  return 'warning';
}

export function maintenanceStatusTone(status: MaintenanceStatus): StatusTone {
  if (status === 'RESOLVED') return 'success';
  if (status === 'OPEN') return 'danger';
  return 'warning';
}

export function canPayRentLine(
  lease: MockLease,
  line: MockRentScheduleEntry,
): boolean {
  return (
    lease.status === 'ACTIVE' &&
    (line.status === 'PENDING' || line.status === 'OVERDUE') &&
    Boolean(line.paymentSessionId)
  );
}

export function canCreateMaintenance(lease: MockLease): boolean {
  return lease.status === 'ACTIVE';
}

export function listRentActivityItems(): Array<{
  id: string;
  leaseId: string;
  propertyId: string;
  statusLabel: string;
  tone: StatusTone;
  meta: string;
}> {
  const rows: Array<{
    id: string;
    leaseId: string;
    propertyId: string;
    statusLabel: string;
    tone: StatusTone;
    meta: string;
    dueDate: string;
  }> = [];

  for (const lease of LEASES) {
    for (const line of listScheduleForLease(lease.id)) {
      rows.push({
        id: line.id,
        leaseId: lease.id,
        propertyId: lease.propertyId,
        statusLabel: rentLineStatusLabel(line.status),
        tone: rentLineStatusTone(line.status),
        meta: `${line.label} · ${formatFcfa(line.amount)}`,
        dueDate: line.dueDate,
      });
    }
  }

  return rows
    .sort((a, b) => b.dueDate.localeCompare(a.dueDate))
    .map(({ dueDate: _dueDate, ...rest }) => rest);
}
