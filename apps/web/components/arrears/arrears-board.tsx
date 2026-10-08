'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  PaginatedDataTable,
  type ListColumn,
} from '@/components/dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  bucketLabel,
  formatMoneyWeb,
  getArrearsSummary,
  listArrears,
  sendLeaseReminder,
  type ArrearsBucketFilter,
  type ArrearsRow,
  type ArrearsSummary,
} from '@/lib/owner/arrears';
import { ROUTES } from '@/lib/routes';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function ArrearsBoard({
  role,
}: {
  role: 'owner' | 'agent';
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [error, setError] = useState<string | null>(null);
  const [bucket, setBucket] = useState<ArrearsBucketFilter | ''>('');
  const [summary, setSummary] = useState<ArrearsSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const leasePath = (id: string) =>
    role === 'agent' ? ROUTES.agent.lease(id) : ROUTES.owner.lease(id);

  const refreshSummary = useCallback(async () => {
    try {
      setSummary(await getArrearsSummary());
    } catch {
      setSummary(null);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void refreshSummary();
  }, [ready, refreshSummary]);

  const sendReminder = useCallback(
    async (row: ArrearsRow) => {
      const message = prompt(
        `Relance pour ${row.tenantName ?? row.tenantPhone ?? 'le locataire'} (montant : ${formatMoneyWeb(row.overdueAmount, row.currency)}). Laissez vide pour le message standard.`,
        '',
      );
      if (message === null) return;
      setBusyId(row.leaseId);
      setError(null);
      try {
        await sendLeaseReminder(row.leaseId, message ? { message } : {});
        await refreshSummary();
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Relance impossible.');
      } finally {
        setBusyId(null);
      }
    },
    [refreshSummary],
  );

  const columns = useMemo<ListColumn<ArrearsRow>[]>(
    () => [
      {
        key: 'propertyTitle',
        label: 'Bien',
        sortable: true,
        render: (value, row) => (
          <Link
            href={leasePath(row.leaseId)}
            className="text-xs text-foreground hover:text-accent hover:underline"
          >
            {String(value)}
          </Link>
        ),
      },
      {
        key: 'tenantName',
        label: 'Locataire',
        sortable: true,
        render: (_value, row) => (
          <span className="text-xs">
            {row.tenantName ?? '—'}
            {row.tenantPhone ? (
              <span className="ml-1 font-mono text-muted">{row.tenantPhone}</span>
            ) : null}
          </span>
        ),
      },
      {
        key: 'overdueAmount',
        label: 'Impayé',
        sortable: true,
        render: (_value, row) => (
          <span className="text-xs font-medium text-danger">
            {formatMoneyWeb(row.overdueAmount, row.currency)}
          </span>
        ),
      },
      {
        key: 'maxDaysOverdue',
        label: 'Ancienneté',
        sortable: true,
        render: (value) => <span className="text-xs">{Number(value)} j</span>,
      },
      {
        key: 'buckets',
        label: 'Répartition',
        render: (_value, row) => (
          <span className="text-xs text-muted">
            {(['d0_30', 'd31_60', 'd60plus'] as const).map((key) =>
              Number(row.buckets[key]) > 0 ? (
                <span key={key} className="mr-2">
                  {bucketLabel(key)} : {formatMoneyWeb(row.buckets[key], row.currency)}
                </span>
              ) : null,
            )}
          </span>
        ),
      },
      {
        key: 'oldestDueDate',
        label: 'Plus ancienne',
        sortable: true,
        className: 'hidden md:table-cell',
        render: (value) =>
          value ? formatDate(String(value)) : <span className="text-xs">—</span>,
      },
    ],
    // leasePath is stable for a given role.
    [role],
  );

  const fetchFn = useCallback(
    (params: { page: number; limit: number }) => {
      void refreshKey;
      return listArrears({
        ...(bucket ? { bucket } : {}),
        page: params.page,
        pageSize: params.limit,
      });
    },
    [bucket, refreshKey],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Impayés" />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      {summary ? (
        <div className="grid gap-3 sm:grid-cols-3">
          {(['d0_30', 'd31_60', 'd60plus'] as const).map((key) => {
            const amount = summary.buckets[summary.currency]?.[key];
            return (
              <div
                key={key}
                className="rounded-lg border border-border bg-card px-4 py-3"
              >
                <p className="text-xs uppercase tracking-wide text-muted">
                  {bucketLabel(key)}
                </p>
                <p className="mt-1 text-sm font-semibold text-foreground">
                  {amount
                    ? formatMoneyWeb(amount, summary.currency)
                    : '—'}
                </p>
              </div>
            );
          })}
        </div>
      ) : null}

      <label className="flex items-center gap-2 text-sm text-muted">
        Ancienneté
        <select
          value={bucket}
          onChange={(e) => {
            setBucket(e.target.value as ArrearsBucketFilter | '');
            setRefreshKey((value) => value + 1);
            void refreshSummary();
          }}
          className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm text-foreground"
        >
          <option value="">Toutes</option>
          <option value="0-30">0-30 jours</option>
          <option value="31-60">31-60 jours</option>
          <option value="60+">Plus de 60 jours</option>
        </select>
      </label>

      <PaginatedDataTable
        key={`${bucket}-${refreshKey}`}
        fetchFn={fetchFn}
        columns={columns}
        entityLabel="baux impayés"
        searchPlaceholder="Rechercher un bien ou un locataire…"
        emptyMessage="Aucun impayé sur le portefeuille."
        tableId={`${role}-arrears-table`}
        onError={(err) =>
          setError(
            err instanceof ApiError
              ? err.message
              : 'Impossible de charger les impayés.',
          )
        }
        actions={(row) => (
          <button
            type="button"
            disabled={busyId === row.leaseId}
            onClick={(e) => {
              e.stopPropagation();
              void sendReminder(row);
            }}
            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
          >
            {busyId === row.leaseId ? 'Envoi…' : 'Relancer'}
          </button>
        )}
      />
    </section>
  );
}
