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
  assignMaintenanceTicket,
  listManagedMaintenance,
  maintenancePriorityLabel,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  updateMaintenanceTicket,
  type PublicMaintenanceTicket,
} from '@/lib/agent/maintenance';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

const STATUS_OPTIONS = [
  'OPEN',
  'ASSIGNED',
  'IN_PROGRESS',
  'RESOLVED',
  'CLOSED',
] as const;

export function AgentMaintenancePage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicMaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [assigneeByTicket, setAssigneeByTicket] = useState<
    Record<string, string>
  >({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedMaintenance();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la maintenance.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleAssign = useCallback(
    async (ticketId: string) => {
      const assigneeId = assigneeByTicket[ticketId]?.trim();
      if (!assigneeId) return;
      setActionId(ticketId);
      try {
        await assignMaintenanceTicket(ticketId, assigneeId);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’assigner le ticket.',
        );
      } finally {
        setActionId(null);
      }
    },
    [assigneeByTicket, load],
  );

  const handleStatus = useCallback(
    async (ticketId: string, status: string) => {
      setActionId(ticketId);
      try {
        await updateMaintenanceTicket(ticketId, { status });
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de mettre à jour le ticket.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<PublicMaintenanceTicket>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      { key: 'title', label: 'Titre', sortable: true },
      {
        key: 'propertyId',
        label: 'Bien',
        className: 'hidden sm:table-cell',
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
      {
        key: 'priority',
        label: 'Priorité',
        sortable: true,
        render: (value) => maintenancePriorityLabel(String(value)),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: (value) => (
          <StatusBadge
            label={maintenanceStatusLabel(String(value))}
            tone={maintenanceStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Maintenance" />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="tickets"
        searchPlaceholder="Rechercher un ticket…"
        emptyMessage="Aucun ticket de maintenance."
        tableId="agent-maintenance-table"
        actions={(row) => (
          <div className="flex min-w-[220px] flex-col gap-2">
            <div className="flex gap-2">
              <input
                value={assigneeByTicket[row.id] ?? ''}
                onChange={(e) =>
                  setAssigneeByTicket((prev) => ({
                    ...prev,
                    [row.id]: e.target.value,
                  }))
                }
                placeholder="ID technicien"
                className="min-w-0 flex-1 rounded-lg border border-border bg-background px-2 py-1 text-xs font-mono"
              />
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleAssign(row.id)}
                className="rounded-lg border border-border px-2 py-1 text-xs font-medium hover:bg-card-hover disabled:opacity-50"
              >
                Assigner
              </button>
            </div>
            <select
              defaultValue={row.status}
              disabled={actionId === row.id}
              onChange={(e) => void handleStatus(row.id, e.target.value)}
              className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {maintenanceStatusLabel(s)}
                </option>
              ))}
            </select>
          </div>
        )}
      />
    </section>
  );
}
