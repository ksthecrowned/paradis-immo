import type { StatusTone } from '@/components/ui/StatusBadge';

export type StayStatus = 'CONFIRMED' | 'PENDING' | 'CANCELLED' | 'COMPLETED';

export type MockStay = {
  id: string;
  propertyId: string;
  status: StayStatus;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalAmount: number;
  currency: 'FCFA';
  agencyId: string;
  agentId: string;
  guests: number;
};

const STAYS: MockStay[] = [
  {
    id: 'stay-1',
    propertyId: '3',
    status: 'CONFIRMED',
    checkIn: '2026-07-12',
    checkOut: '2026-07-14',
    nights: 2,
    totalAmount: 90_000,
    currency: 'FCFA',
    agencyId: 'ag-cote-sauvage',
    agentId: 'ag-cote-sauvage-2',
    guests: 4,
  },
  {
    id: 'stay-2',
    propertyId: '2',
    status: 'PENDING',
    checkIn: '2026-08-01',
    checkOut: '2026-08-03',
    nights: 2,
    totalAmount: 200_000,
    currency: 'FCFA',
    agencyId: 'ag-habitat-pn',
    agentId: 'ag-habitat-pn-1',
    guests: 2,
  },
  {
    id: 'stay-3',
    propertyId: '3',
    status: 'COMPLETED',
    checkIn: '2026-06-10',
    checkOut: '2026-06-12',
    nights: 2,
    totalAmount: 90_000,
    currency: 'FCFA',
    agencyId: 'ag-cote-sauvage',
    agentId: 'ag-cote-sauvage-2',
    guests: 3,
  },
];

export function listMockStays(): MockStay[] {
  return [...STAYS].sort((a, b) => b.checkIn.localeCompare(a.checkIn));
}

export function listUpcomingStays(): MockStay[] {
  return listMockStays().filter(
    (stay) => stay.status === 'CONFIRMED' || stay.status === 'PENDING',
  );
}

export function getMockStay(id: string): MockStay | undefined {
  return STAYS.find((stay) => stay.id === id);
}

export function stayStatusLabel(status: StayStatus): string {
  const map: Record<StayStatus, string> = {
    CONFIRMED: 'Confirmé',
    PENDING: 'En attente',
    CANCELLED: 'Annulé',
    COMPLETED: 'Terminé',
  };
  return map[status];
}

export function stayStatusTone(status: StayStatus): StatusTone {
  const map: Record<StayStatus, StatusTone> = {
    CONFIRMED: 'success',
    PENDING: 'warning',
    CANCELLED: 'danger',
    COMPLETED: 'neutral',
  };
  return map[status];
}
