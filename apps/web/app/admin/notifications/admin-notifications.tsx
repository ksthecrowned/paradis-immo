'use client';

import { appDialog } from '@/components/dialogs/app-dialog';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  FilterTabs,
  ListDataTable,
  StatusBadge,
  type FilterTabItem,
  type ListColumn,
} from '@/components/dashboard';
import { ApiErrorBanner } from '@/components/forms';
import { ApiError } from '@/lib/api';
import {
  listFailedNotifications,
  notificationStatusTone,
  NOTIFICATION_STATUS_LABELS,
  retryNotification,
  type AdminFailedNotification,
} from '@/lib/admin/notifications';
import { DASH_ICONS } from '@/lib/dash-icons';
import { useRequireSession } from '@/hooks/use-require-session';

type StatusFilter = 'ALL' | 'FAILED' | 'QUEUED';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    timeZone: 'Africa/Brazzaville',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function canRetry(status: string): boolean {
  return status === 'FAILED' || status === 'QUEUED';
}

export function AdminNotificationsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<AdminFailedNotification[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listFailedNotifications({
        page: 1,
        pageSize: 100,
        status: filter,
      });
      setRows(result.data);
      setTotal(result.meta.total);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les notifications en échec.',
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const handleRetry = useCallback(
    async (row: AdminFailedNotification) => {
      if (!canRetry(row.status)) return;
      if (
        !(await appDialog.confirm({
          title: 'Relancer l’envoi',
          message: `Relancer la notification ${row.type} (${NOTIFICATION_STATUS_LABELS[row.status] ?? row.status}) vers ${row.recipient.phoneMasked ?? 'destinataire masqué'} ?`,
          confirmLabel: 'Relancer',
          variant: 'default',
        }))
      ) {
        return;
      }
      setActionId(row.id);
      setSuccessMsg(null);
      try {
        const result = await retryNotification(row.id);
        setSuccessMsg(
          `Relance effectuée — nouveau statut : ${NOTIFICATION_STATUS_LABELS[result.status] ?? result.status}.`,
        );
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de relancer cette notification.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const filterItems = useMemo<FilterTabItem<StatusFilter>[]>(
    () => [
      {
        id: 'ALL',
        label: 'Tous',
        icon: DASH_ICONS.dashboard,
        count: filter === 'ALL' ? total : undefined,
      },
      {
        id: 'FAILED',
        label: 'Échecs',
        icon: DASH_ICONS.close,
        count: filter === 'FAILED' ? total : undefined,
      },
      {
        id: 'QUEUED',
        label: 'En file',
        icon: DASH_ICONS.activity,
        count: filter === 'QUEUED' ? total : undefined,
      },
    ],
    [filter, total],
  );

  const columns = useMemo<ListColumn<AdminFailedNotification>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        className: 'whitespace-nowrap',
        render: (value) => formatDateTime(String(value)),
      },
      {
        key: 'recipient',
        label: 'Destinataire',
        render: (_value, row) =>
          row.recipient.phoneMasked ??
          (row.recipient.name ? row.recipient.name : '—'),
        getFilterValue: (row) =>
          row.recipient.phoneMasked ?? row.recipient.name ?? '',
      },
      {
        key: 'type',
        label: 'Type',
        sortable: true,
        filterable: true,
      },
      {
        key: 'channel',
        label: 'Canal',
        sortable: true,
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: (value) => {
          const status = String(value);
          return (
            <StatusBadge
              label={NOTIFICATION_STATUS_LABELS[status] ?? status}
              tone={notificationStatusTone(status)}
            />
          );
        },
      },
      {
        key: 'attempts',
        label: 'Tentatives',
        sortable: true,
      },
      {
        key: 'retryAfter',
        label: 'Prochaine tentative',
        className: 'whitespace-nowrap',
        render: (value) => formatDateTime(value ? String(value) : null),
      },
      {
        key: 'lastError',
        label: 'Dernière erreur',
        render: (value) => (value ? String(value) : '—'),
      },
    ],
    [],
  );

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Notifications — échecs"
        description="File des envois échoués ou en attente de relance. Les modèles et statistiques seront ajoutés séparément."
      />

      <FilterTabs
        ariaLabel="Filtrer les notifications"
        items={filterItems}
        value={filter}
        onChange={setFilter}
      />

      {error ? <ApiErrorBanner message={error} /> : null}
      {successMsg ? (
        <p className="rounded-md border border-border bg-card px-4 py-3 text-sm text-heading">
          {successMsg}
        </p>
      ) : null}

      <ListDataTable
        tableId="admin-notifications-failed"
        columns={columns}
        data={rows}
        loading={loading}
        onRefresh={load}
        entityLabel="notifications"
        searchPlaceholder="Rechercher type, destinataire…"
        emptyMessage="Aucune notification en échec ou en file."
        rowIdKey="id"
        actions={(row) =>
          canRetry(row.status) ? (
            <button
              type="button"
              disabled={actionId === row.id}
              aria-label="Relancer l’envoi"
              onClick={() => void handleRetry(row)}
            >
              {actionId === row.id ? 'Relance…' : 'Relancer'}
            </button>
          ) : null
        }
      />

      {!loading && total > 0 ? (
        <p className="text-xs text-muted">{total} notification(s)</p>
      ) : null}
    </section>
  );
}
