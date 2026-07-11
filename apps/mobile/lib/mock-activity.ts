import type { StatusTone } from '@/components/ui/StatusBadge';
import { listRentActivityItems } from '@/lib/mock-leases';
import { getPropertyById } from '@/lib/mock-properties';

export type ActivitySegment =
  | 'visits'
  | 'bookings'
  | 'sales'
  | 'payments'
  | 'rents';

export type ActivityItem = {
  id: string;
  segment: ActivitySegment;
  propertyId: string;
  leaseId?: string;
  title: string;
  location: string;
  statusLabel: string;
  tone: StatusTone;
  meta: string;
};

function base(
  propertyId: string,
  partial: Omit<ActivityItem, 'title' | 'location' | 'propertyId'> & {
    propertyId?: string;
  },
): ActivityItem {
  const property = getPropertyById(propertyId);
  return {
    ...partial,
    propertyId,
    title: property?.title ?? 'Bien',
    location: property?.location ?? 'Pointe-Noire',
  };
}

const ITEMS: ActivityItem[] = [
  base('1', {
    id: 'act-v1',
    segment: 'visits',
    statusLabel: 'Confirmée',
    tone: 'success',
    meta: 'Demain · 10:00 – 10:30',
  }),
  base('2', {
    id: 'act-v2',
    segment: 'visits',
    statusLabel: 'En attente',
    tone: 'warning',
    meta: 'Ven. 18 juil. · 15:00',
  }),
  base('3', {
    id: 'act-b1',
    segment: 'bookings',
    statusLabel: 'Confirmée',
    tone: 'success',
    meta: '12 – 14 juil. · 90 000 FCFA',
  }),
  base('2', {
    id: 'act-b2',
    segment: 'bookings',
    statusLabel: 'Annulée',
    tone: 'danger',
    meta: '1 – 31 août',
  }),
  base('1', {
    id: 'act-s1',
    segment: 'sales',
    statusLabel: 'Envoyée',
    tone: 'neutral',
    meta: 'Demande d’achat · Hier',
  }),
  base('3', {
    id: 'act-p1',
    segment: 'payments',
    statusLabel: 'Payé',
    tone: 'success',
    meta: 'Mobile Money · 90 000 FCFA',
  }),
  base('1', {
    id: 'act-p2',
    segment: 'payments',
    statusLabel: 'En attente',
    tone: 'warning',
    meta: 'Espèces · 5 000 FCFA',
  }),
];

export function listMockActivity(segment: ActivitySegment): ActivityItem[] {
  if (segment === 'rents') {
    return listRentActivityItems().map((row) => {
      const property = getPropertyById(row.propertyId);
      return {
        id: row.id,
        segment: 'rents' as const,
        propertyId: row.propertyId,
        leaseId: row.leaseId,
        title: property?.title ?? 'Bien',
        location: property?.location ?? 'Pointe-Noire',
        statusLabel: row.statusLabel,
        tone: row.tone,
        meta: row.meta,
      };
    });
  }
  return ITEMS.filter((item) => item.segment === segment);
}

export const ACTIVITY_TABS: Array<{ key: ActivitySegment; label: string }> = [
  { key: 'visits', label: 'Visites' },
  { key: 'bookings', label: 'Réservations' },
  { key: 'sales', label: 'Achats' },
  { key: 'payments', label: 'Paiements' },
  { key: 'rents', label: 'Loyers' },
];
