import { apiFetch } from '@/lib/api';
import { DASH_ICONS } from '@/lib/dash-icons';
import { ROUTES } from '@/lib/routes';
import type { DashboardRole } from '@/components/dashboard/sidebar-nav';

export type PublicNotification = {
  id: string;
  userId: string;
  channel: string;
  type: string;
  payload: Record<string, unknown>;
  status: string;
  sentAt: string | null;
  readAt: string | null;
  createdAt: string;
};

export type NotificationKind = 'visit' | 'payment' | 'maintenance' | 'mandate' | 'info';

export type NotificationView = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  createdAt: string;
  read: boolean;
  href: string | null;
  icon: string;
};

function stringField(
  payload: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const value = payload[key];
  return typeof value === 'string' ? value : fallback;
}

export function notificationTitle(type: string): string {
  const map: Record<string, string> = {
    VISIT_CONFIRMED: 'Visite confirmée',
    VISIT_REMINDER: 'Rappel de visite',
    VISIT_CHANGED: 'Visite modifiée',
    PAYMENT_RECEIPT_READY: 'Paiement reçu',
    PAYMENT_RECEIVED: 'Paiement reçu',
    PAYMENT_FAILED: 'Paiement échoué',
    RENT_DUE_SOON: 'Loyer à venir',
    RENT_OVERDUE: 'Loyer en retard',
    MAINTENANCE_OPENED: 'Maintenance enregistrée',
    MAINTENANCE_NEW: 'Nouveau ticket',
    MAINTENANCE_UPDATE: 'Maintenance mise à jour',
    APPROVAL_PENDING: 'Action en attente',
    APPROVAL_REQUESTED: 'Approbation demandée',
    APPROVAL_DECIDED: 'Décision d’approbation',
    MANDATE_PROPOSED: 'Mandat proposé',
    MANDATE_ACCEPTED: 'Mandat accepté',
    MANDATE_TERMINATED: 'Mandat résilié',
    MANDATE_ASSIGNED: 'Mandat assigné',
    LISTING_MODERATED: 'Annonce modérée',
    BUYER_PAYMENT_PROOF_REQUESTED: 'Demande de preuves',
    SOLVENCY_CHECK_REQUESTED: 'Demande de solvabilité',
    NEW_MESSAGE: 'Nouveau message',
  };
  return map[type] ?? 'Paradis Immo';
}

export function notificationBody(
  type: string,
  payload: Record<string, unknown>,
): string {
  const org = stringField(payload, 'organizationName');
  switch (type) {
    case 'VISIT_CONFIRMED':
      return 'Votre visite est confirmée.';
    case 'VISIT_REMINDER':
      return 'Rappel : une visite approche.';
    case 'VISIT_CHANGED':
      return 'Une visite a été annulée ou reprogrammée.';
    case 'PAYMENT_RECEIPT_READY':
    case 'PAYMENT_RECEIVED':
      return 'Votre reçu de paiement est disponible.';
    case 'PAYMENT_FAILED':
      return 'Un paiement n’a pas abouti.';
    case 'RENT_DUE_SOON':
      return `Échéance le ${stringField(payload, 'dueDate')} · ${stringField(payload, 'amount')} ${stringField(payload, 'currency', 'XAF')}`;
    case 'RENT_OVERDUE':
      return `En retard de ${stringField(payload, 'daysOverdue')} jour(s).`;
    case 'MAINTENANCE_OPENED':
    case 'MAINTENANCE_NEW':
      return `Priorité ${stringField(payload, 'priority', 'normale')}.`;
    case 'MAINTENANCE_UPDATE':
      return 'Le statut d’un ticket de maintenance a changé.';
    case 'BUYER_PAYMENT_PROOF_REQUESTED':
      return `${org || 'Un vendeur'} demande l’accès à vos preuves.`;
    case 'SOLVENCY_CHECK_REQUESTED':
      return `${org || 'Un logeur'} demande à consulter vos loyers.`;
    case 'LISTING_MODERATED':
      return stringField(payload, 'reason', 'Votre annonce a été modérée.');
    default: {
      const title = stringField(payload, 'title');
      const body = stringField(payload, 'body') || stringField(payload, 'message');
      if (title || body) return [title, body].filter(Boolean).join(' — ');
      return type.replaceAll('_', ' ').toLowerCase();
    }
  }
}

export function notificationKind(type: string): NotificationKind {
  if (type.includes('VISIT')) return 'visit';
  if (type.includes('PAYMENT') || type.includes('RENT')) return 'payment';
  if (type.includes('MAINTENANCE')) return 'maintenance';
  if (type.includes('MANDATE') || type.includes('APPROVAL')) return 'mandate';
  return 'info';
}

export function notificationIcon(kind: NotificationKind): string {
  switch (kind) {
    case 'visit':
      return DASH_ICONS.calendar;
    case 'payment':
      return DASH_ICONS.wallet;
    case 'maintenance':
      return DASH_ICONS.wrench;
    case 'mandate':
      return DASH_ICONS.mandate;
    default:
      return DASH_ICONS.bell;
  }
}

export function formatNotificationTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  const now = Date.now();
  const diffMs = now - date.getTime();
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return 'À l’instant';
  if (mins < 60) return `Il y a ${mins} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `Il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Hier';
  if (days < 7) return `Il y a ${days} j`;
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
  });
}

export function resolveNotificationHref(
  role: DashboardRole,
  type: string,
  payload: Record<string, unknown>,
): string | null {
  const paymentId = stringField(payload, 'paymentId');
  if (paymentId) {
    if (role === 'owner') return ROUTES.owner.payment(paymentId);
    if (role === 'agent') return ROUTES.agent.payment(paymentId);
  }

  const ticketId =
    stringField(payload, 'ticketId') || stringField(payload, 'maintenanceId');
  if (ticketId) {
    if (role === 'owner') return ROUTES.owner.maintenanceTicket(ticketId);
    if (role === 'agent') return ROUTES.agent.maintenanceTicket(ticketId);
  }

  const leaseId = stringField(payload, 'leaseId');
  if (leaseId) {
    if (role === 'owner') return ROUTES.owner.lease(leaseId);
    if (role === 'agent') return ROUTES.agent.lease(leaseId);
  }

  const mandateId = stringField(payload, 'mandateId');
  if (mandateId) {
    if (role === 'owner') return ROUTES.owner.mandateDetail(mandateId);
    if (role === 'agent') return ROUTES.agent.mandate(mandateId);
  }

  const propertyId = stringField(payload, 'propertyId');
  if (propertyId) {
    if (role === 'owner') return ROUTES.owner.property(propertyId);
    if (role === 'agent') return ROUTES.agent.property(propertyId);
  }

  if (type.includes('VISIT')) {
    if (role === 'owner') return ROUTES.owner.visits;
    if (role === 'agent') return ROUTES.agent.visits;
  }
  if (type.includes('RENT') || type.includes('PAYMENT')) {
    if (role === 'owner') return ROUTES.owner.payments;
    if (role === 'agent') return ROUTES.agent.payments;
  }
  if (type.includes('MAINTENANCE')) {
    if (role === 'owner') return ROUTES.owner.maintenance;
    if (role === 'agent') return ROUTES.agent.maintenance;
  }
  if (type.includes('MANDATE') || type.includes('APPROVAL')) {
    if (role === 'owner') return ROUTES.owner.mandate;
    if (role === 'agent') return ROUTES.agent.mandates;
  }
  if (type === 'LISTING_MODERATED' && role === 'admin') {
    return ROUTES.admin.moderation;
  }

  return null;
}

export function mapNotification(
  row: PublicNotification,
  role: DashboardRole,
): NotificationView {
  const kind = notificationKind(row.type);
  return {
    id: row.id,
    kind,
    title: notificationTitle(row.type),
    body: notificationBody(row.type, row.payload),
    time: formatNotificationTime(row.createdAt),
    createdAt: row.createdAt,
    read: Boolean(row.readAt),
    href: resolveNotificationHref(role, row.type, row.payload),
    icon: notificationIcon(kind),
  };
}

export function notificationsPath(role: DashboardRole): string {
  return `/${role}/notifications`;
}

export async function listMyNotifications(): Promise<PublicNotification[]> {
  return apiFetch<PublicNotification[]>('/notifications/my');
}

export async function markNotificationRead(
  id: string,
): Promise<PublicNotification> {
  return apiFetch<PublicNotification>(`/notifications/${id}/read`, {
    method: 'PATCH',
  });
}

export async function markAllNotificationsRead(): Promise<{ updated: number }> {
  return apiFetch<{ updated: number }>('/notifications/my/read-all', {
    method: 'PATCH',
  });
}

export type NotificationDayGroup = {
  title: string;
  items: NotificationView[];
};

function dayKey(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'other';
  return date.toLocaleDateString('fr-CA'); // YYYY-MM-DD
}

function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Autres';
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const key = dayKey(iso);
  if (key === dayKey(today.toISOString())) return "Aujourd'hui";
  if (key === dayKey(yesterday.toISOString())) return 'Hier';
  return date.toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function groupNotificationsByDay(
  items: NotificationView[],
): NotificationDayGroup[] {
  const order: string[] = [];
  const map = new Map<string, NotificationDayGroup>();

  for (const item of items) {
    const key = dayKey(item.createdAt);
    let group = map.get(key);
    if (!group) {
      group = { title: dayLabel(item.createdAt), items: [] };
      map.set(key, group);
      order.push(key);
    }
    group.items.push(item);
  }

  return order.map((key) => map.get(key)!);
}
