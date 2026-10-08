'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import type { PaginatedMeta } from '@/lib/http/types';
import {
  listMyPayouts,
  payoutStatusLabel,
  payoutStatusTone,
  requestPayout,
  type PublicPayout,
} from '@/lib/owner/payouts';
import { ROUTES } from '@/lib/routes';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

type Notice = { tone: 'success' | 'danger'; message: string } | null;

function errorNotice(err: unknown): Notice {
  if (!(err instanceof ApiError)) {
    return { tone: 'danger', message: 'Impossible de demander le reversement.' };
  }
  const body = (err.body ?? {}) as Record<string, unknown>;
  if (body.code === 'MINIMUM_PAYOUT_NOT_REACHED') {
    return {
      tone: 'danger',
      message: `Solde disponible ${formatMoney(String(body.balance ?? 0), 'XAF')} — seuil atteint : ${formatMoney(String(body.minPayoutAmount ?? 0), 'XAF')}.`,
    };
  }
  if (body.code === 'NO_VERIFIED_PAYOUT_ACCOUNT') {
    return {
      tone: 'danger',
      message: 'Aucun compte de reversement vérifié. Ajoutez-en un puis vérifiez-le.',
    };
  }
  return { tone: 'danger', message: err.message };
}

/** Spec 05 — onglet « Reversements » de /owner/payments. */
export function OwnerPayoutsPanel(): React.JSX.Element {
  const [rows, setRows] = useState<PublicPayout[]>([]);
  const [meta, setMeta] = useState<PaginatedMeta | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [requesting, setRequesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listMyPayouts({ page, pageSize });
      setRows(result.data);
      setMeta(result.meta);
      setNotice(null);
    } catch (err) {
      setNotice({
        tone: 'danger',
        message:
          err instanceof ApiError
            ? err.message
            : 'Impossible de charger les reversements.',
      });
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRequest = useCallback(async () => {
    if (!confirm('Demander un reversement du solde disponible ?')) return;
    setRequesting(true);
    try {
      const payout = await requestPayout();
      setNotice({
        tone: 'success',
        message: `Reversement de ${formatMoney(payout.amount, payout.currency)} demandé.`,
      });
      setPage(1);
      await load();
    } catch (err) {
      setNotice(errorNotice(err));
    } finally {
      setRequesting(false);
    }
  }, [load]);

  const columns = useMemo<ListColumn<PublicPayout>[]>(
    () => [
      {
        key: 'createdAt',
        label: 'Date',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'amount',
        label: 'Montant',
        sortable: true,
        render: (_value, row) => formatMoney(row.amount, row.currency),
        getFilterValue: (row) => `${row.amount} ${row.currency}`,
      },
      {
        key: 'account',
        label: 'Compte',
        sortable: false,
        render: (_value, row) =>
          row.account
            ? `${row.account.type === 'BANK' ? 'Banque' : 'Mobile money'} · ${row.account.masked}`
            : '—',
        getFilterValue: (row) => row.account?.masked ?? '',
      },
      {
        key: 'kind',
        label: 'Type',
        sortable: true,
        render: (value) => (value === 'OWNER_NET' ? 'Net propriétaire' : String(value)),
        getFilterValue: (row) => (row.kind === 'OWNER_NET' ? 'Net propriétaire' : row.kind),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: (value) => (
          <StatusBadge
            label={payoutStatusLabel(String(value))}
            tone={payoutStatusTone(String(value))}
          />
        ),
      },
      {
        key: 'paidAt',
        label: 'Versé le',
        sortable: true,
        className: 'hidden sm:table-cell',
        render: (value) => (value ? formatDate(String(value)) : '—'),
      },
    ],
    [],
  );

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={requesting}
            onClick={() => void handleRequest()}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-on-accent hover:bg-accent/90 disabled:opacity-50"
          >
            {requesting ? 'Demande…' : 'Demander un reversement'}
          </button>
          <Link
            href={ROUTES.owner.settingsPayout}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
          >
            Comptes de reversement
          </Link>
        </div>
      </div>

      {notice ? (
        <div
          role="alert"
          className={
            notice.tone === 'success'
              ? 'rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-success'
              : 'rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger'
          }
        >
          {notice.message}
        </div>
      ) : null}

      <ListDataTable
        data={rows}
        columns={columns}
        loading={loading}
        onRefresh={load}
        entityLabel="reversements"
        searchPlaceholder="Rechercher un reversement…"
        emptyMessage="Aucun reversement pour l’instant."
        tableId="owner-payouts-table"
        totalCount={meta?.total}
        totalPages={meta?.totalPages}
        page={page}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
        serverSide
        enableClientFilters
      />
    </section>
  );
}
