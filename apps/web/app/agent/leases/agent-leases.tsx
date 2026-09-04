'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  activateLease,
  listManagedLeases,
  requestLeaseSign,
  type PublicLease,
} from '@/lib/agent/leases';
import { ApiError } from '@/lib/api';
import { leaseStatusLabel, leaseStatusTone } from '@/lib/owner/leases';
import { ROUTES } from '@/lib/routes';
import { useCallback, useEffect, useMemo, useState } from 'react';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function AgentLeasesPage(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [leases, setLeases] = useState<PublicLease[]>([]);
  const [loadingLeases, setLoadingLeases] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadLeases = useCallback(async () => {
    setLoadingLeases(true);
    try {
      const data = await listManagedLeases();
      setLeases(data);
      setError(null);
    } catch (err) {
      setLeases([]);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les baux.',
      );
    } finally {
      setLoadingLeases(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadLeases();
  }, [loadLeases, ready]);

  const handleRequestSign = useCallback(
    async (id: string) => {
      setActionId(id);
      try {
        await requestLeaseSign(id);
        await loadLeases();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de demander la signature.',
        );
      } finally {
        setActionId(null);
      }
    },
    [loadLeases],
  );

  const handleActivate = useCallback(
    async (id: string) => {
      if (!confirm('Activer ce bail et générer l’échéancier de loyers ?')) {
        return;
      }
      setActionId(id);
      try {
        await activateLease(id);
        await loadLeases();
        setError(null);
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’activer le bail.',
        );
      } finally {
        setActionId(null);
      }
    },
    [loadLeases],
  );

  const columns = useMemo<ListColumn<PublicLease>[]>(
    () => [
      {
        key: 'id',
        label: 'Réf.',
        sortable: true,
        render: (_value, row) => (
          <Link
            href={ROUTES.agent.lease(row.id)}
            className="font-mono text-xs text-accent hover:underline"
          >
            {row.id.slice(0, 8)}…
          </Link>
        ),
      },
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        render: (value) => (
          <Link
            href={ROUTES.agent.property(String(value))}
            className="font-mono text-xs text-muted hover:text-accent hover:underline"
          >
            {String(value).slice(0, 8)}…
          </Link>
        ),
      },
      {
        key: 'startDate',
        label: 'Début',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'endDate',
        label: 'Fin',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'monthlyRent',
        label: 'Loyer',
        sortable: true,
        render: (_value, row) => formatMoney(row.monthlyRent, row.currency),
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
          { value: 'TERMINATED', label: 'Résilié' },
        ],
        render: (value) => (
          <StatusBadge
            label={leaseStatusLabel(String(value))}
            tone={leaseStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Baux"
        actions={
          <Link href={ROUTES.agent.leasesAdd}>
            <Button type="button">Créer un bail</Button>
          </Link>
        }
      />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      <ListDataTable
        data={leases}
        columns={columns}
        loading={loadingLeases}
        onRefresh={loadLeases}
        entityLabel="baux"
        searchPlaceholder="Rechercher un bail…"
        emptyMessage="Aucun bail pour le moment."
        tableId="agent-leases-table"
        onRowClick={(row) => {
          router.push(ROUTES.agent.lease(row.id));
        }}
        actions={(row) =>
          row.status === 'DRAFT' ? (
            <div className="flex flex-wrap gap-2">
              <Link
                href={ROUTES.agent.leaseEdit(row.id)}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-hover"
                onClick={(e) => e.stopPropagation()}
              >
                Modifier
              </Link>
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleRequestSign(row.id);
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-hover disabled:opacity-50"
              >
                Demander signature
              </button>
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={(e) => {
                  e.stopPropagation();
                  void handleActivate(row.id);
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                Activer
              </button>
            </div>
          ) : (
            <Link
              href={ROUTES.agent.lease(row.id)}
              className="text-xs font-medium text-accent hover:underline"
              onClick={(e) => e.stopPropagation()}
            >
              Voir
            </Link>
          )
        }
      />
    </section>
  );
}
