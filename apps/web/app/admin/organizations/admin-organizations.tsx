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
  listAdminOrganizations,
  ORGANIZATION_TYPE_LABELS,
  AFFILIATION_LABELS,
  affiliationTone,
  type AdminOrganizationRow,
  type AffiliationStatus,
  type OrganizationType,
} from '@/lib/admin/organizations';
import { useRequireSession } from '@/hooks/use-require-session';

/** Liste des agences et propriétaires déclarés (spec 02 supervision admin). */
export function AdminOrganizationsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<AdminOrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrganizationType | 'ALL'>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminOrganizations({
        type: filter === 'ALL' ? undefined : filter,
      });
      setRows(result.data);
      // total utile pour l'en-tête; stocké via state interne de la table.
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les organisations.',
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (!ready) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, filter]);

  const columns = useMemo<ListColumn<AdminOrganizationRow>[]>(() => [
    { key: 'name', label: 'Nom', sortable: true },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      filterable: true,
      filterType: 'select',
      filterOptions: [
        { value: 'AGENCY', label: 'Agence' },
        { value: 'OWNER', label: 'Propriétaire' },
        { value: 'PLATFORM', label: 'Plateforme' },
      ],
      render: (value) => ORGANIZATION_TYPE_LABELS[value as OrganizationType],
    },
    {
      key: 'affiliationStatus',
      label: 'Statut',
      render: (value) =>
        value ? (
          <StatusBadge
            label={AFFILIATION_LABELS[value as AffiliationStatus]}
            tone={affiliationTone(value as AffiliationStatus | null)}
          />
        ) : (
          <span className="text-slate-400">—</span>
        ),
    },
    {
      key: 'propertyCount',
      label: 'Biens',
      sortable: true,
      render: (value, row) =>
        row.type === 'PLATFORM' ? '—' : String(value),
    },
    {
      key: 'memberCount',
      label: 'Membres',
      sortable: true,
      render: (value, row) =>
        row.type === 'PLATFORM' ? '—' : String(value),
    },
    {
      key: 'cityLabel',
      label: 'Ville',
      render: (value) => (value ? String(value) : '—'),
    },
    {
      key: 'phone',
      label: 'Contact',
      render: (_value, row) => (
        <div className="text-xs">
          <p>{row.phone ?? '—'}</p>
          <p className="text-muted">{row.email ?? ''}</p>
        </div>
      ),
    },
    {
      key: 'createdAt',
      label: 'Créée le',
      sortable: true,
      render: (value) => new Date(String(value)).toLocaleDateString('fr-FR'),
    },
  ], []);

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Agences & organisations" />
      <div className="flex flex-wrap gap-2">
        {(['ALL', 'AGENCY', 'OWNER'] as const).map((key) => (
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
            {key === 'ALL' ? 'Toutes' : ORGANIZATION_TYPE_LABELS[key]}
          </button>
        ))}
      </div>
      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      <ListDataTable
        tableId="admin-organizations-table"
        columns={columns}
        data={rows}
        loading={loading}
        onRefresh={load}
        entityLabel="organisations"
        searchPlaceholder="Rechercher une agence…"
        emptyMessage="Aucune organisation."
      />
    </section>
  );
}
