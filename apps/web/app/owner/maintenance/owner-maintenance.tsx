'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { ApiErrorBanner } from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  listManagedMaintenance,
  maintenancePriorityLabel,
  maintenanceStatusLabel,
  maintenanceStatusTone,
  type PublicMaintenanceTicket,
} from '@/lib/owner/maintenance';
import { ROUTES } from '@/lib/routes';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function OwnerMaintenancePage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicMaintenanceTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  const columns = useMemo<ListColumn<PublicMaintenanceTicket>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'title',
        label: 'Titre',
        sortable: true,
      },
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => (
          <span className="font-mono text-sm text-muted">
            {String(value).slice(0, 8)}…
          </span>
        ),
      },
      {
        key: 'priority',
        label: 'Priorité',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'LOW', label: 'Basse' },
          { value: 'MEDIUM', label: 'Moyenne' },
          { value: 'HIGH', label: 'Haute' },
          { value: 'URGENT', label: 'Urgente' },
        ],
        render: (value) => maintenancePriorityLabel(String(value)),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        filterable: true,
        filterType: 'select',
        filterOptions: [
          { value: 'OPEN', label: 'Ouvert' },
          { value: 'ASSIGNED', label: 'Assigné' },
          { value: 'IN_PROGRESS', label: 'En cours' },
          { value: 'DONE', label: 'Terminé' },
          { value: 'CLOSED', label: 'Fermé' },
        ],
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

  if (!ready) {
    return <p className="text-base text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Maintenance"
        actions={
          <Link href={ROUTES.owner.maintenanceAdd}>
            <Button icon="mdi:plus" variant="primary">
              Ouvrir un ticket
            </Button>
          </Link>
        }
      />

      <ApiErrorBanner message={error} />

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="tickets"
        searchPlaceholder="Rechercher un ticket…"
        emptyMessage={
          <span className="inline-flex flex-col items-center gap-3 py-2">
            <span>Aucun ticket de maintenance.</span>
            <Link href={ROUTES.owner.maintenanceAdd}>
              <Button icon="mdi:plus" variant="primary">
                Ouvrir un ticket
              </Button>
            </Link>
          </span>
        }
        tableId="owner-maintenance-table"
        actions={(row) => (
          <Link
            href={ROUTES.owner.maintenanceTicket(row.id)}
            className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-base text-foreground hover:bg-card-hover"
          >
            <Icon icon="mdi:eye-outline" className="h-4 w-4" />
            Voir
          </Link>
        )}
      />
    </section>
  );
}
