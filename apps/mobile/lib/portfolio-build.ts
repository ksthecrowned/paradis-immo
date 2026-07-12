import type { PublicBooking } from '@/lib/bookings';
import type { PublicLease, RentLineView } from '@/lib/leases';
import type { PublicSaleInquiry } from '@/lib/sales';
import type { PublicVisitBooking } from '@/lib/visits';

export type PortfolioRelation =
  | 'tenant'
  | 'purchase_active'
  | 'purchase_owned'
  | 'stay'
  | 'visit';

export type PortfolioItem = {
  propertyId: string;
  relations: PortfolioRelation[];
  primaryRelation: PortfolioRelation;
  lastAt: string;
  nextDue?: RentLineView;
  activeLease?: PublicLease;
};

const RELATION_PRIORITY: PortfolioRelation[] = [
  'tenant',
  'purchase_active',
  'stay',
  'visit',
  'purchase_owned',
];

function dayKey(iso: string): string {
  return iso.slice(0, 10);
}

function inquiryRelation(status: string): PortfolioRelation {
  if (status === 'CLOSED') return 'visit';
  return 'purchase_active';
}

function pickPrimary(relations: Set<PortfolioRelation>): PortfolioRelation {
  for (const key of RELATION_PRIORITY) {
    if (relations.has(key)) return key;
  }
  return 'visit';
}

export function portfolioRelationLabel(relation: PortfolioRelation): string {
  const map: Record<PortfolioRelation, string> = {
    tenant: 'Locataire',
    purchase_active: 'Achat en cours',
    purchase_owned: 'Acquis',
    stay: 'Séjour',
    visit: 'Visite',
  };
  return map[relation];
}

export type PortfolioSources = {
  leases: PublicLease[];
  bookings: PublicBooking[];
  visits: PublicVisitBooking[];
  inquiries: PublicSaleInquiry[];
  nextDueByLeaseId?: Record<string, RentLineView>;
};

/** Pure aggregator — unit-testable without network. */
export function buildPortfolioProperties(
  sources: PortfolioSources,
): PortfolioItem[] {
  const byId = new Map<
    string,
    { relations: Set<PortfolioRelation>; lastAt: string; lease?: PublicLease }
  >();

  const touch = (
    propertyId: string,
    relation: PortfolioRelation,
    at: string,
    lease?: PublicLease,
  ): void => {
    const current = byId.get(propertyId) ?? {
      relations: new Set<PortfolioRelation>(),
      lastAt: dayKey(at),
    };
    current.relations.add(relation);
    const day = dayKey(at);
    if (day > current.lastAt) current.lastAt = day;
    if (lease?.status === 'ACTIVE') current.lease = lease;
    byId.set(propertyId, current);
  };

  for (const lease of sources.leases) {
    const at = lease.endDate || lease.startDate;
    if (lease.status === 'ACTIVE') {
      touch(lease.propertyId, 'tenant', at, lease);
    } else {
      touch(lease.propertyId, 'visit', at);
    }
  }

  for (const booking of sources.bookings) {
    if (booking.status === 'CANCELLED') continue;
    touch(booking.propertyId, 'stay', booking.startDate);
  }

  for (const inquiry of sources.inquiries) {
    touch(
      inquiry.propertyId,
      inquiryRelation(inquiry.status),
      inquiry.createdAt,
    );
  }

  for (const visit of sources.visits) {
    if (visit.status === 'CANCELLED') continue;
    const at = visit.slotStartAt ?? visit.createdAt;
    touch(visit.propertyId, 'visit', at);
  }

  const items: PortfolioItem[] = [];
  for (const [propertyId, row] of byId) {
    const activeLease =
      row.lease ??
      sources.leases.find(
        (l) => l.propertyId === propertyId && l.status === 'ACTIVE',
      );
    items.push({
      propertyId,
      relations: [...row.relations],
      primaryRelation: pickPrimary(row.relations),
      lastAt: row.lastAt,
      activeLease,
      nextDue:
        activeLease != null
          ? sources.nextDueByLeaseId?.[activeLease.id]
          : undefined,
    });
  }

  return items.sort((a, b) => b.lastAt.localeCompare(a.lastAt));
}

export function getActiveLeaseFromList(
  leases: PublicLease[],
  propertyId: string,
): PublicLease | undefined {
  return leases.find(
    (l) => l.propertyId === propertyId && l.status === 'ACTIVE',
  );
}

export type TimelineEventKind =
  | 'visit'
  | 'stay'
  | 'purchase'
  | 'lease'
  | 'rent';

export type TimelineEvent = {
  id: string;
  kind: TimelineEventKind;
  at: string;
  title: string;
  meta?: string;
  stayId?: string;
  purchaseId?: string;
  leaseId?: string;
};

function visitLabel(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: 'Confirmée',
    PENDING: 'En attente',
    CANCELLED: 'Annulée',
  };
  return map[status] ?? status;
}

export function buildPropertyTimeline(
  propertyId: string,
  sources: Omit<PortfolioSources, 'nextDueByLeaseId'>,
): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const visit of sources.visits) {
    if (visit.propertyId !== propertyId) continue;
    const at = dayKey(visit.slotStartAt ?? visit.createdAt);
    events.push({
      id: visit.id,
      kind: 'visit',
      at,
      title: `Visite · ${visitLabel(visit.status)}`,
      meta: visit.slotStartAt ? dayKey(visit.slotStartAt) : undefined,
    });
  }

  for (const booking of sources.bookings) {
    if (booking.propertyId !== propertyId) continue;
    events.push({
      id: booking.id,
      kind: 'stay',
      at: dayKey(booking.startDate),
      title: 'Séjour',
      meta: `${dayKey(booking.startDate)} → ${dayKey(booking.endDate)}`,
      stayId: booking.id,
    });
  }

  for (const inquiry of sources.inquiries) {
    if (inquiry.propertyId !== propertyId) continue;
    events.push({
      id: inquiry.id,
      kind: 'purchase',
      at: dayKey(inquiry.createdAt),
      title: 'Demande d’achat',
      meta: inquiry.message ?? inquiry.status,
      purchaseId: inquiry.id,
    });
  }

  for (const lease of sources.leases) {
    if (lease.propertyId !== propertyId) continue;
    events.push({
      id: `${lease.id}-start`,
      kind: 'lease',
      at: dayKey(lease.startDate),
      title: lease.status === 'ACTIVE' ? 'Bail démarré' : 'Bail',
      leaseId: lease.id,
    });
    if (lease.endDate && lease.status === 'TERMINATED') {
      events.push({
        id: `${lease.id}-end`,
        kind: 'lease',
        at: dayKey(lease.endDate),
        title: 'Bail terminé',
        leaseId: lease.id,
      });
    }
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}
