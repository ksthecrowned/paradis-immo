import {
  resolveNotificationRoute,
  type NotificationDeepLink,
} from '@/lib/notification-routes';
import type { PublicInboxNotification } from '@/lib/inbox-notifications-types';

export type NotificationKind = 'visit' | 'payment' | 'favorite' | 'info';

export type InboxNotificationView = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  time: string;
  read: boolean;
  link: NotificationDeepLink | null;
};

function stringField(
  payload: Record<string, unknown>,
  key: string,
  fallback = '',
): string {
  const v = payload[key];
  return typeof v === 'string' ? v : fallback;
}

export function notificationTitle(type: string): string {
  const map: Record<string, string> = {
    VISIT_CONFIRMED: 'Visite confirmée',
    PAYMENT_RECEIPT_READY: 'Paiement reçu',
    RENT_DUE_SOON: 'Loyer à venir',
    RENT_OVERDUE: 'Loyer en retard',
    MAINTENANCE_OPENED: 'Maintenance enregistrée',
    APPROVAL_PENDING: 'Action en attente',
    BUYER_PAYMENT_PROOF_REQUESTED: 'Demande de preuves',
    SOLVENCY_CHECK_REQUESTED: 'Demande de solvabilité',
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
    case 'PAYMENT_RECEIPT_READY':
      return 'Votre reçu de paiement est disponible.';
    case 'RENT_DUE_SOON':
      return `Échéance le ${stringField(payload, 'dueDate')} · ${stringField(payload, 'amount')} ${stringField(payload, 'currency', 'XAF')}`;
    case 'RENT_OVERDUE':
      return `En retard de ${stringField(payload, 'daysOverdue')} jour(s).`;
    case 'MAINTENANCE_OPENED':
      return `Priorité ${stringField(payload, 'priority', 'normale')}.`;
    case 'BUYER_PAYMENT_PROOF_REQUESTED':
      return `${org || 'Un vendeur'} demande l’accès à vos preuves.`;
    case 'SOLVENCY_CHECK_REQUESTED':
      return `${org || 'Un logeur'} demande à consulter vos loyers.`;
    default: {
      const entries = Object.entries(payload).slice(0, 2);
      if (entries.length === 0) return type;
      return entries
        .map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`)
        .join(' · ');
    }
  }
}

export function notificationKind(type: string): NotificationKind {
  if (type.includes('VISIT')) return 'visit';
  if (type.includes('PAYMENT') || type.includes('RENT')) return 'payment';
  if (type.includes('FAVORITE')) return 'favorite';
  return 'info';
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

export function mapInboxNotification(
  row: PublicInboxNotification,
): InboxNotificationView {
  return {
    id: row.id,
    kind: notificationKind(row.type),
    title: notificationTitle(row.type),
    body: notificationBody(row.type, row.payload),
    time: formatNotificationTime(row.createdAt),
    read: Boolean(row.readAt),
    link: resolveNotificationRoute({
      type: row.type,
      ...row.payload,
    }),
  };
}
