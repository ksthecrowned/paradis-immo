'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  listAdminReports,
  updateAdminReport,
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  type AdminReportRow,
  type PropertyReportStatus,
} from '@/lib/admin/reports';
import { useRequireSession } from '@/hooks/use-require-session';

function statusTone(
  status: PropertyReportStatus,
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'OPEN') return 'warning';
  if (status === 'ACTIONED') return 'success';
  if (status === 'DISMISSED') return 'neutral';
  return 'neutral';
}

export function AdminReportsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<AdminReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [filter, setFilter] = useState<PropertyReportStatus | 'ALL'>('OPEN');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminReports({
        status: filter === 'ALL' ? undefined : filter,
      });
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
  }, [filter]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleUpdate = useCallback(
    async (id: string, status: PropertyReportStatus, label: string) => {
      if (!confirm(`${label} ce signalement ?`)) return;
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
        render: (value) =>
          REPORT_REASON_LABELS[value as keyof typeof REPORT_REASON_LABELS] ??
          String(value),
      },
      {
        key: 'description',
        label: 'Détail',
        render: (value) => (value ? String(value) : '—'),
      },
      {
        key: 'status',
        label: 'Statut',
        render: (value) => {
          const status = value as PropertyReportStatus;
          return (
            <StatusBadge
              label={REPORT_STATUS_LABELS[status]}
              tone={statusTone(status)}
            />
          );
        },
      },
      {
        key: 'createdAt',
        label: 'Date',
        render: (value) =>
          new Date(String(value)).toLocaleDateString('fr-FR'),
      },
      {
        key: 'id',
        label: 'Actions',
        render: (_value, row) => (
          <div className="flex flex-wrap gap-2">
            {row.status === 'OPEN' ? (
              <>
                <button
                  type="button"
                  className="text-sm text-emerald-700 underline disabled:opacity-50"
                  disabled={actionId === row.id}
                  onClick={() =>
                    void handleUpdate(row.id, 'ACTIONED', 'Marquer comme traité')
                  }
                >
                  Traité
                </button>
                <button
                  type="button"
                  className="text-sm text-slate-600 underline disabled:opacity-50"
                  disabled={actionId === row.id}
                  onClick={() =>
                    void handleUpdate(row.id, 'DISMISSED', 'Rejeter')
                  }
                >
                  Rejeter
                </button>
              </>
            ) : (
              <span className="text-sm text-slate-400">—</span>
            )}
          </div>
        ),
      },
    ],
    [actionId, handleUpdate],
  );

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Signalements" />
      <div className="flex flex-wrap gap-2">
        {(['OPEN', 'ALL', 'ACTIONED', 'DISMISSED'] as const).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-full px-3 py-1 text-sm font-medium ${
              filter === key
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
          >
            {key === 'ALL' ? 'Tous' : REPORT_STATUS_LABELS[key]}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <ListDataTable
        tableId="admin-reports-table"
        columns={columns}
        data={rows}
        loading={loading}
        onRefresh={load}
        entityLabel="signalements"
        searchPlaceholder="Rechercher…"
        emptyMessage="Aucun signalement."
      />
    </section>
  );
}
