'use client';

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
  listAdminOrganizations,
  ORGANIZATION_TYPE_LABELS,
  AFFILIATION_LABELS,
  affiliationTone,
  type AdminOrganizationRow,
  type AffiliationStatus,
  type OrganizationType,
} from '@/lib/admin/organizations';
import { DASH_ICONS } from '@/lib/dash-icons';
import { useRequireSession } from '@/hooks/use-require-session';

type OrgFilter = OrganizationType | 'ALL';

/** Liste des agences et propriétaires déclarés (spec 02 supervision admin). */
export function AdminOrganizationsPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<AdminOrganizationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<OrgFilter>('ALL');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listAdminOrganizations({});
      setRows(result.data);
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
  }, []);

  useEffect(() => {
    if (!ready) return;
    void Promise.resolve().then(() => load());
  }, [load, ready]);

  const counts = useMemo(() => {
    const next: Record<OrgFilter, number> = {
      ALL: rows.length,
      AGENCY: 0,
      OWNER: 0,
      PLATFORM: 0,
    };
    for (const row of rows) {
      next[row.type] += 1;
    }
    return next;
  }, [rows]);

  const visibleRows = useMemo(
    () =>
      filter === 'ALL' ? rows : rows.filter((row) => row.type === filter),
    [filter, rows],
  );

  const filterItems = useMemo<FilterTabItem<OrgFilter>[]>(
    () => [
      {
        id: 'ALL',
        label: 'Toutes',
        icon: DASH_ICONS.dashboard,
        count: counts.ALL,
      },
      {
        id: 'AGENCY',
        label: ORGANIZATION_TYPE_LABELS.AGENCY,
        icon: DASH_ICONS.buildings,
        count: counts.AGENCY,
      },
      {
        id: 'OWNER',
        label: ORGANIZATION_TYPE_LABELS.OWNER,
        icon: DASH_ICONS.user,
        count: counts.OWNER,
      },
    ],
    [counts],
  );

  const columns = useMemo<ListColumn<AdminOrganizationRow>[]>(
    () => [
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
            <span className="text-muted">—</span>
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
    ],
    [],
  );

  return (
    <section className="space-y-4">
      <DashboardPageHeader title="Agences & organisations" />
      <FilterTabs
        ariaLabel="Filtrer les organisations"
        items={filterItems}
        value={filter}
        onChange={setFilter}
      />
      <ApiErrorBanner message={error} />
      <ListDataTable
        tableId="admin-organizations-table"
        columns={columns}
        data={visibleRows}
        loading={loading}
        onRefresh={load}
        entityLabel="organisations"
        searchPlaceholder="Rechercher une agence…"
        emptyMessage="Aucune organisation."
      />
    </section>
  );
}
