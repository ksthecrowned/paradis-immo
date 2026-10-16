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
  listAdminReports,
  updateAdminReport,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  reportStatusTone,
  type AdminReportRow,
  type PropertyReportStatus,
} from '@/lib/admin/reports';
import { DASH_ICONS } from '@/lib/dash-icons';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

type ReportFilter = PropertyReportStatus | 'ALL';

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function AdminReportsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<ReportFilter>('OPEN');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminReports({ pageSize: 100 });
      setRows(result.data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les signalements.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const handleUpdate = useCallback(
    async (id: string, status: PropertyReportStatus, label: string) => {
      if (
        !(await appDialog.confirm({
          title: label,
          message: `${label} ce signalement ?`,
          confirmLabel: label,
          variant: status === 'DISMISSED' ? 'danger' : 'default',
        }))
      ) {
        return;
      }
      setActionId(id);
      try {
        await updateAdminReport(id, status);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de mettre à jour le signalement.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const counts = useMemo(() => {
    const next: Record<ReportFilter, number> = {
      ALL: rows.length,
      OPEN: 0,
      ACTIONED: 0,
      DISMISSED: 0,
      REVIEWED: 0,
    };
    for (const row of rows) {
      next[row.status] = (next[row.status] ?? 0) + 1;
    }
    return next;
  }, [rows]);

  const visibleRows = useMemo(
    () => (filter === 'ALL' ? rows : rows.filter((row) => row.status === filter)),
    [filter, rows],
  );

  const filterItems = useMemo<FilterTabItem<ReportFilter>[]>(
    () => [
      {
        id: 'ALL',
        label: 'Tous',
        icon: DASH_ICONS.dashboard,
        count: counts.ALL,
      },
      {
        id: 'OPEN',
        label: REPORT_STATUS_LABELS.OPEN,
        icon: DASH_ICONS.activity,
        count: counts.OPEN,
      },
      {
        id: 'ACTIONED',
        label: REPORT_STATUS_LABELS.ACTIONED,
        icon: 'solar:check-circle-linear',
        count: counts.ACTIONED,
      },
      {
        id: 'DISMISSED',
        label: REPORT_STATUS_LABELS.DISMISSED,
        icon: DASH_ICONS.close,
        count: counts.DISMISSED,
      },
    ],
    [counts],
  );

  const columns = useMemo<ListColumn<AdminReportRow>[]>(
    () => [
      {
        key: 'propertyTitle',
        label: 'Annonce',
        sortable: true,
      },
      {
        key: 'reason',
        label: 'Motif',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: Object.entries(REPORT_REASON_LABELS).map(
          ([value, label]) => ({ value, label }),
        ),
        render: (value) =>
          REPORT_REASON_LABELS[value as keyof typeof REPORT_REASON_LABELS] ??
          String(value),
        getFilterValue: (row) => row.reason,
      },
      {
        key: 'description',
        label: 'Détail',
        render: (value) => (value ? String(value) : '—'),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: (value) => {
          const status = value as PropertyReportStatus;
          return (
            <StatusBadge
              label={REPORT_STATUS_LABELS[status]}
              tone={reportStatusTone(status)}
            />
          );
        },
      },
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        className: 'whitespace-nowrap',
        render: (value) => (
          <time dateTime={String(value)} title={formatDateTime(String(value))}>
            {formatDate(String(value))}
          </time>
        ),
        getFilterValue: (row) => formatDate(row.createdAt),
      },
    ],
    [],
  );

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Signalements" />
      <FilterTabs
        ariaLabel="Filtrer les signalements"
        items={filterItems}
        value={filter}
        onChange={setFilter}
      />
      <ApiErrorBanner message={error} />
      <ListDataTable
        tableId="admin-reports-table"
        columns={columns}
        data={visibleRows}
        loading={loading}
        onRefresh={load}
        entityLabel="signalements"
        searchPlaceholder="Rechercher…"
        emptyMessage="Aucun signalement."
        viewHref={(row) => ROUTES.admin.report(row.id)}
        viewLabel="Voir les détails"
        actions={(row) =>
          row.status === 'OPEN' ? (
            <>
              <button
                type="button"
                disabled={actionId === row.id}
                aria-label="Marquer comme traité"
                onClick={() =>
                  void handleUpdate(
                    row.id,
                    'ACTIONED',
                    'Marquer comme traité',
                  )
                }
              >
                {actionId === row.id
                  ? 'Mise à jour…'
                  : 'Marquer comme traité'}
              </button>
              <button
                type="button"
                disabled={actionId === row.id}
                aria-label="Rejeter le signalement"
                onClick={() =>
                  void handleUpdate(row.id, 'DISMISSED', 'Rejeter')
                }
              >
                Rejeter
              </button>
            </>
          ) : null
        }
      />
    </section>
  );
}
