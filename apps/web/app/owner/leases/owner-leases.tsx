'use client';

import Link from 'next/link';
import {
  DashboardPageHeader,
  PaginatedDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { Button } from '@/components/primitives/Button';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { fetchManagedLeases } from '@/lib/owner/lease-queries';
import {
  activateLease,
  cancelLease,
  closeLease,
  leaseStatusLabel,
  leaseStatusTone,
  sendLeaseForSignature,
  terminateLease,
  withdrawTermination,
  type PublicLease,
} from '@/lib/owner/leases';
import { ROUTES } from '@/lib/routes';
import { useCallback, useMemo, useState } from 'react';

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

export function OwnerLeasesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [error, setError] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const runAction = useCallback(
    async (id: string, label: string, fn: () => Promise<unknown>) => {
      setActionId(id);
      setError(null);
      try {
        await fn();
        setRefreshKey((value) => value + 1);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : label);
      } finally {
        setActionId(null);
      }
    },
    [],
  );

  const columns = useMemo<ListColumn<PublicLease>[]>(
    () => [
      {
        key: 'propertyId',
        label: 'Bien',
        sortable: true,
        render: (value) => (
          <Link
            href={ROUTES.owner.property(String(value))}
            className="font-mono text-xs text-muted hover:text-accent hover:underline"
          >
            {String(value).slice(0, 8)}…
          </Link>
        ),
      },
      {
        key: 'tenantPhone',
        label: 'Locataire',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (_value, row) => (
          <span className="text-xs text-foreground">
            {row.tenantName ?? '—'}
            {row.tenantPhone ? (
              <span className="ml-1 font-mono text-muted">{row.tenantPhone}</span>
            ) : null}
            {!row.tenantId ? (
              <span className="ml-1 rounded bg-accent/15 px-1.5 py-0.5 text-[10px] text-accent">
                invité
              </span>
            ) : null}
          </span>
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
        className: 'hidden md:table-cell',
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'monthlyRent',
        label: 'Loyer',
        sortable: true,
        render: (_value, row) => (
          <span className="text-xs">
            {formatMoney(row.monthlyRent, row.currency)}
            {Number(row.chargesAmount) > 0 ? (
              <span className="ml-1 text-muted">
                +{formatMoney(row.chargesAmount, row.currency)} charges
              </span>
            ) : null}
          </span>
        ),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
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

  const query = useMemo(
    () => ({
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(overdueOnly ? { overdue: true } : {}),
    }),
    [statusFilter, overdueOnly],
  );

  const fetchFn = useCallback(
    (params: Parameters<typeof fetchManagedLeases>[0]) => {
      void refreshKey;
      return fetchManagedLeases({ ...query, ...params });
    },
    [query, refreshKey],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Baux"
        actions={
          <Link href={ROUTES.owner.leasesAdd}>
            <Button icon="mdi:plus" variant="primary">
              Créer un bail
            </Button>
          </Link>
        }
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-muted">
          Statut
          <select
            value={statusFilter ?? ''}
            onChange={(e) =>
              setStatusFilter(e.target.value === '' ? undefined : e.target.value)
            }
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
          >
            <option value="">Tous</option>
            <option value="DRAFT">Brouillon</option>
            <option value="PENDING_SIGNATURE">En attente de signature</option>
            <option value="ACTIVE">Actif</option>
            <option value="TERMINATING">En préavis</option>
            <option value="TERMINATED">Terminé</option>
            <option value="CANCELLED">Annulé</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-muted">
          <input
            type="checkbox"
            checked={overdueOnly}
            onChange={(e) => setOverdueOnly(e.target.checked)}
          />
          Impayés uniquement
        </label>
      </div>

      <PaginatedDataTable
        key={`${statusFilter ?? 'all'}-${overdueOnly}-${refreshKey}`}
        fetchFn={fetchFn}
        columns={columns}
        entityLabel="baux"
        searchPlaceholder="Rechercher un bail…"
        emptyMessage="Aucun bail à afficher."
        tableId="owner-leases-table"
        onError={(err) =>
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger les baux.',
          )
        }
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            {row.status === 'DRAFT' ? (
              <>
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    void runAction(
                      row.id,
                      'Impossible d’envoyer le bail.',
                      () => sendLeaseForSignature(row.id),
                    );
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                >
                  Envoyer pour signature
                </button>
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm('Annuler ce bail ?')) return;
                    void runAction(row.id, 'Impossible d’annuler le bail.', () =>
                      cancelLease(row.id),
                    );
                  }}
                  className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  Annuler
                </button>
              </>
            ) : null}
            {row.status === 'DRAFT' || row.status === 'PENDING_SIGNATURE' ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={(e) => {
                  e.stopPropagation();
                  if (
                    !confirm(
                      'Activer ce bail ? Le bien passe en occupé et l’échéancier est généré.',
                    )
                  ) {
                    return;
                  }
                  void runAction(row.id, 'Impossible d’activer le bail.', () =>
                    activateLease(row.id),
                  );
                }}
                className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
              >
                Activer
              </button>
            ) : null}
            {row.status === 'ACTIVE' ? (
              <button
                type="button"
                disabled={actionId === row.id}
                onClick={(e) => {
                  e.stopPropagation();
                  const requestedEndDate = prompt(
                    'Date de sortie souhaitée (AAAA-MM-JJ) ?',
                    new Date(Date.now() + 90 * 86400000)
                      .toISOString()
                      .slice(0, 10),
                  );
                  if (!requestedEndDate) return;
                  void runAction(row.id, 'Impossible d’enregistrer le congé.', () =>
                    terminateLease(row.id, {
                      initiator: 'LANDLORD',
                      requestedEndDate,
                    }),
                  );
                }}
                className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
              >
                Congé
              </button>
            ) : null}
            {row.status === 'TERMINATING' ? (
              <>
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm('Retirer le congé déposé ?')) return;
                    void runAction(row.id, 'Impossible de retirer le congé.', () =>
                      withdrawTermination(row.id),
                    );
                  }}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
                >
                  Retirer le congé
                </button>
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!confirm('Clôturer ce bail ? Le bien redevient disponible.')) {
                      return;
                    }
                    void runAction(row.id, 'Impossible de clôturer le bail.', () =>
                      closeLease(row.id),
                    );
                  }}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
                >
                  Clôturer
                </button>
              </>
            ) : null}
            <Link
              href={ROUTES.owner.lease(row.id)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
              onClick={(e) => e.stopPropagation()}
            >
              Voir
            </Link>
          </div>
        )}
      />
    </section>
  );
}