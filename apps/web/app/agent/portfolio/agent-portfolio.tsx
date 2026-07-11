'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import { listOrgProperties } from '@/lib/agent/portfolio';
import { agentOrganizationIds, listMyOrganizations } from '@/lib/me';
import {
  formatPropertyPrice,
  propertyModeLabel,
  propertyStatusLabel,
  propertyStatusTone,
  type PublicProperty,
} from '@/lib/owner/properties';
import { useRequireSession } from '@/hooks/use-require-session';

export function AgentPortfolioPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const orgs = await listMyOrganizations();
      const orgIds = agentOrganizationIds(orgs);
      if (orgIds.length === 0) {
        setRows([]);
        setError(null);
        return;
      }
      const lists = await Promise.all(orgIds.map((id) => listOrgProperties(id)));
      setRows(lists.flat());
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le portefeuille.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const columns = useMemo<ListColumn<PublicProperty>[]>(
    () => [
      {
        key: 'title',
        label: 'Titre',
        sortable: true,
      },
      {
        key: 'mode',
        label: 'Mode',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'RENT_LONG', label: 'Location longue' },
          { value: 'RENT_SHORT', label: 'Location courte' },
          { value: 'SALE', label: 'Vente' },
        ],
        render: (value) => propertyModeLabel(String(value)),
      },
      {
        key: 'price',
        label: 'Prix',
        sortable: true,
        render: (value, row) =>
          formatPropertyPrice(Number(value), row.currency, row.priceUnit),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'ACTIVE', label: 'Actif' },
          { value: 'DRAFT', label: 'Brouillon' },
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
        key: 'quartier',
        label: 'Quartier',
        className: 'hidden md:table-cell',
        render: (_value, row) => row.quartier.name,
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Portefeuille" />

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
        emptyMessage="Aucun bien dans votre portefeuille."
        tableId="agent-portfolio-table"
      />
    </section>
  );
}
