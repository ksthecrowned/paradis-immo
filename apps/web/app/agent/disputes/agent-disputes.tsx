'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  disputeReasonLabel,
  disputeStatusLabel,
  disputeStatusTone,
  listManagedDisputes,
  resolveDispute,
  type PublicDispute,
} from '@/lib/disputes';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

const ACTIONABLE = new Set(['OPEN', 'AWAITING_MANAGER', 'ESCALATED']);

export function AgentDisputesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Portefeuille géré côté serveur (owner / gérant / agent assigné).
      const data = await listManagedDisputes();
      setRows(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les litiges.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleResolve = useCallback(
    async (
      dispute: PublicDispute,
      status: 'RESOLVED_ACCEPTED' | 'RESOLVED_REJECTED',
    ) => {
      const label = status === 'RESOLVED_ACCEPTED' ? 'accepter' : 'rejeter';
      if (!confirm(`Confirmer : ${label} ce litige ?`)) return;
      const resolution =
        window.prompt('Résolution (facultatif) :', '') ?? undefined;
      setResolvingId(dispute.id);
      try {
        await resolveDispute(dispute.id, {
          status,
          ...(resolution ? { resolution } : {}),
        });
        await load();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de répondre au litige.',
        );
      } finally {
        setResolvingId(null);
      }
    },
    [load],
  );

  const columns = useMemo<ListColumn<PublicDispute>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Ouvert le',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'paymentId',
        label: 'Paiement',
        sortable: true,
        render: (value) => (
          <Link
            href={ROUTES.agent.payment(String(value))}
            className="text-accent hover:underline"
          >
            {String(value).slice(0, 10)}…
          </Link>
        ),
      },
      {
        key: 'reason',
        label: 'Motif',
        sortable: true,
        render: (value) => disputeReasonLabel(String(value)),
        getFilterValue: (row) => disputeReasonLabel(row.reason),
      },
      {
        key: 'description',
        label: 'Description',
        render: (value) => (
          <span className="line-clamp-2 max-w-md">{String(value)}</span>
        ),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: (value) => {
          const status = String(value);
          return (
            <StatusBadge
              label={disputeStatusLabel(status)}
              tone={disputeStatusTone(status)}
            />
          );
        },
        getFilterValue: (row) => disputeStatusLabel(row.status),
      },
    ],
    [],
  );

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Litiges"
        breadcrumb={[{ label: 'Paiements', href: ROUTES.agent.paymentsValidation }]}
      />

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
        entityLabel="litiges"
        searchPlaceholder="Rechercher un litige…"
        emptyMessage="Aucun litige sur votre portefeuille."
        tableId="agent-disputes-table"
        actions={(row) => (
          <div className="flex flex-wrap gap-2">
            <Link
              href={ROUTES.agent.payment(row.paymentId)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-card-hover"
            >
              Voir
            </Link>
            {ACTIONABLE.has(row.status) ? (
              <>
                <button
                  type="button"
                  disabled={resolvingId === row.id}
                  onClick={() =>
                    void handleResolve(row, 'RESOLVED_ACCEPTED')
                  }
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
                >
                  Accepter
                </button>
                <button
                  type="button"
                  disabled={resolvingId === row.id}
                  onClick={() =>
                    void handleResolve(row, 'RESOLVED_REJECTED')
                  }
                  className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger/10 disabled:opacity-50"
                >
                  Rejeter
                </button>
              </>
            ) : null}
          </div>
        )}
      />
    </section>
  );
}
