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
  cancelVisit,
  confirmVisit,
  listManagedVisits,
  type PublicVisitBooking,
} from '@/lib/agent/visits';
import { useRequireSession } from '@/hooks/use-require-session';

function visitTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function visitLabel(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: 'Confirmée',
    PENDING: 'En attente',
    CANCELLED: 'Annulée',
  };
  return map[status] ?? status;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function AgentVisitsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicVisitBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listManagedVisits();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Impossible de charger les visites.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleConfirm = useCallback(
    async (id: string) => {
      setActionId(id);
      try {
        await confirmVisit(id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Impossible de confirmer la visite.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const handleCancel = useCallback(
    async (id: string) => {
      if (!confirm('Annuler cette visite ?')) return;
      setActionId(id);
      try {
        await cancelVisit(id);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError ? err.message : 'Impossible d\'annuler la visite.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<PublicVisitBooking>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
      {
        key: 'userId',
        label: 'Visiteur',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'PENDING', label: 'En attente' },
          { value: 'CONFIRMED', label: 'Confirmée' },
          { value: 'CANCELLED', label: 'Annulée' },
        ],
        render: (value) => (
          <StatusBadge
            label={visitLabel(String(value))}
            tone={visitTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Visites" />

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
        entityLabel="visites"
        searchPlaceholder="Rechercher une visite…"
        emptyMessage="Aucune visite à afficher."
        tableId="agent-visits-table"
        actions={(row) =>
          row.status === 'PENDING' ? (
            <>
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleConfirm(row.id)}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                Confirmer
              </button>
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleCancel(row.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-hover disabled:opacity-50"
              >
                Annuler
              </button>
            </>
          ) : null
        }
      />
    </section>
  );
}
