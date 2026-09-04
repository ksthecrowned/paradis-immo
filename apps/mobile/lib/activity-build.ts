import type { PublicBooking } from '@/lib/bookings';
import { formatDateFr } from '@/lib/format-date-fr';
import type { PublicLease, RentLineView } from '@/lib/leases';
import type { PublicPayment } from '@/lib/payments';
import type { PublicSaleInquiry } from '@/lib/sales';
import type { PublicVisitBooking } from '@/lib/visits';

export type ActivitySegment =
  | 'visits'
  | 'bookings'
  | 'sales'
  | 'payments'
  | 'rents';

export type ActivityTone = 'success' | 'warning' | 'danger' | 'neutral';

export type ActivityItem = {
  id: string;
  segment: ActivitySegment;
  propertyId: string;
  leaseId?: string;
  stayId?: string;
  purchaseId?: string;
  title: string;
  location: string;
  statusLabel: string;
  tone: ActivityTone;
  meta: string;
};

export type ProspectSection = {
  key: 'upcoming' | 'in_progress';
  title: string;
  items: ActivityItem[];
};

export const ACTIVITY_TABS: Array<{ key: ActivitySegment; label: string }> = [
  { key: 'visits', label: 'Visites' },
  { key: 'bookings', label: 'Réservations' },
  { key: 'sales', label: 'Achats' },
  { key: 'payments', label: 'Paiements' },
  { key: 'rents', label: 'Loyers' },
];

type PropertyGlance = { title: string; location: string };

function formatFcfa(amount: number | string): string {
  const n = typeof amount === 'string' ? Number(amount) : amount;
  const safe = Number.isFinite(n) ? n : 0;
  return `${safe.toLocaleString('fr-FR').replace(/\u202f/g, ' ')} FCFA`;
}

function labelTone(
  map: Record<string, { label: string; tone: ActivityTone }>,
  status: string,
): { label: string; tone: ActivityTone } {
  return map[status] ?? { label: status, tone: 'neutral' };
}

const VISIT = {
  CONFIRMED: { label: 'Confirmée', tone: 'success' as const },
  PENDING: { label: 'En attente', tone: 'warning' as const },
  CANCELLED: { label: 'Annulée', tone: 'danger' as const },
};

const BOOKING = {
  CONFIRMED: { label: 'Confirmée', tone: 'success' as const },
  PENDING: { label: 'En attente', tone: 'warning' as const },
  CANCELLED: { label: 'Annulée', tone: 'danger' as const },
};

const SALE = {
  NEW: { label: 'Nouvelle', tone: 'warning' as const },
  CONTACTED: { label: 'Contacté', tone: 'success' as const },
  VISIT_SCHEDULED: { label: 'Visite planifiée', tone: 'neutral' as const },
  CLOSED: { label: 'Clôturée', tone: 'neutral' as const },
};

const PAYMENT = {
  INITIATED: { label: 'Initié', tone: 'warning' as const },
  PENDING_VALIDATION: {
    label: 'En attente de validation',
    tone: 'warning' as const,
  },
  VALIDATED: { label: 'Validé', tone: 'success' as const },
  FAILED: { label: 'Échoué', tone: 'danger' as const },
  PENDING: { label: 'En cours', tone: 'warning' as const },
};

const RENT = {
  PENDING: { label: 'À payer', tone: 'warning' as const },
  PAID: { label: 'Payé', tone: 'success' as const },
  OVERDUE: { label: 'En retard', tone: 'danger' as const },
};

const METHOD: Record<string, string> = {
  CASH: 'Espèces',
  MOBILE_MONEY: 'Mobile Money',
};

function formatVisitMeta(visit: PublicVisitBooking): string {
  const start = visit.slotStartAt ? new Date(visit.slotStartAt) : null;
  const end = visit.slotEndAt ? new Date(visit.slotEndAt) : null;
  if (!start || Number.isNaN(start.getTime())) {
    return formatDateFr(visit.createdAt);
  }
  const day = start.toLocaleDateString('fr-FR', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const startLabel = start.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  if (!end || Number.isNaN(end.getTime())) {
    return `${day} · ${startLabel}`;
  }
  const endLabel = end.toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} · ${startLabel} – ${endLabel}`;
}

function formatBookingMeta(booking: PublicBooking): string {
  const start = formatDateFr(booking.startDate);
  const end = formatDateFr(booking.endDate);
  return `${start} – ${end} · ${formatFcfa(booking.totalPrice)}`;
}

export function mapVisitToActivityItem(
  visit: PublicVisitBooking,
  glance: PropertyGlance,
): ActivityItem {
  const st = labelTone(VISIT, visit.status);
  return {
    id: visit.id,
    segment: 'visits',
    propertyId: visit.propertyId,
    title: glance.title,
    location: glance.location,
    statusLabel: st.label,
    tone: st.tone,
    meta: formatVisitMeta(visit),
  };
}

export function mapBookingToActivityItem(
  booking: PublicBooking,
  glance: PropertyGlance,
): ActivityItem {
  const st = labelTone(BOOKING, booking.status);
  return {
    id: booking.id,
    segment: 'bookings',
    propertyId: booking.propertyId,
    stayId: booking.id,
    title: glance.title,
    location: glance.location,
    statusLabel: st.label,
    tone: st.tone,
    meta: formatBookingMeta(booking),
  };
}

export function mapSaleInquiryToActivityItem(
  inquiry: PublicSaleInquiry,
  glance: PropertyGlance,
): ActivityItem {
  const st = labelTone(SALE, inquiry.status);
  return {
    id: inquiry.id,
    segment: 'sales',
    propertyId: inquiry.propertyId,
    purchaseId: inquiry.id,
    title: glance.title,
    location: glance.location,
    statusLabel: st.label,
    tone: st.tone,
    meta: `Demande d’achat · ${formatDateFr(inquiry.createdAt)}`,
  };
}

export function mapPaymentToActivityItem(
  payment: PublicPayment,
  glance?: PropertyGlance,
): ActivityItem {
  const st = labelTone(PAYMENT, payment.status);
  return {
    id: payment.id,
    segment: 'payments',
    propertyId: '',
    title: glance?.title ?? 'Paiement',
    location: glance?.location ?? '—',
    statusLabel: st.label,
    tone: st.tone,
    meta: `${METHOD[payment.method] ?? payment.method} · ${formatFcfa(payment.amount)}`,
  };
}

export function mapRentLineToActivityItem(
  lease: PublicLease,
  line: RentLineView,
  glance: PropertyGlance,
): ActivityItem {
  const st = labelTone(RENT, line.status);
  return {
    id: line.id,
    segment: 'rents',
    propertyId: lease.propertyId,
    leaseId: lease.id,
    title: glance.title,
    location: glance.location,
    statusLabel: st.label,
    tone: st.tone,
    meta: `${line.label} · ${formatFcfa(line.amount)}`,
  };
}

export function buildProspectPipeline(items: {
  visits: ActivityItem[];
  bookings: ActivityItem[];
  sales: ActivityItem[];
  payments: ActivityItem[];
}): ProspectSection[] {
  return [
    {
      key: 'upcoming',
      title: 'À venir',
      items: items.visits.filter((item) => item.tone !== 'danger'),
    },
    {
      key: 'in_progress',
      title: 'En cours',
      items: [...items.bookings, ...items.sales, ...items.payments].filter(
        (item) => item.tone !== 'danger',
      ),
    },
  ];
}
