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
  listPropertiesForModeration,
  moderateProperty,
} from '@/lib/admin/properties';
import {
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  type PublicProperty,
  type PropertyStatus,
} from '@/lib/owner/properties';
import { useRequireSession } from '@/hooks/use-require-session';

export function AdminModerationPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listPropertiesForModeration();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les biens.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleModerate = useCallback(
    async (id: string, status: PropertyStatus, label: string) => {
      if (!confirm(`${label} ce bien ?`)) return;
      setActionId(id);
      try {
        await moderateProperty(id, status);
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de modérer le bien.',
        );
      } finally {
        setActionId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<PublicProperty>[]>(
    () => [
      { key: 'title', label: 'Titre', sortable: true },
      {
        key: 'mode',
        label: 'Mode',
        sortable: true,
        render: (value) => propertyModeLabel(String(value)),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'DRAFT', label: 'Brouillon' },
          { value: 'ACTIVE', label: 'Actif' },
          { value: 'PAUSED', label: 'En pause' },
          { value: 'ARCHIVED', label: 'Archivé' },
        ],
        render: (value) => (
          <StatusBadge
            label={propertyStatusLabel(String(value))}
            tone={propertyStatusTone(String(value))}
          />
        ),
      },
      {
        key: 'ownerId',
        label: 'Propriétaire',
        className: 'hidden md:table-cell',
        render: (value) => (
          <span className="font-mono text-xs text-muted">{String(value).slice(0, 8)}…</span>
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Modération des biens" />

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
        entityLabel="biens"
        searchPlaceholder="Rechercher un bien…"
        emptyMessage="Aucun bien à modérer."
        tableId="admin-moderation-table"
        actions={(row) => (
          <>
            {row.status !== 'ACTIVE' ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleModerate(row.id, 'ACTIVE', 'Activer')}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                Activer
              </button>
            ) : null}
            {row.status !== 'PAUSED' ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleModerate(row.id, 'PAUSED', 'Mettre en pause')}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-hover disabled:opacity-50"
              >
                Pause
              </button>
            ) : null}
            {row.status !== 'ARCHIVED' ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={() => void handleModerate(row.id, 'ARCHIVED', 'Archiver')}
                className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
              >
                Archiver
              </button>
            ) : null}
          </>
        )}
      />
    </section>
  );
}
