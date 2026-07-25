'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { Button } from '@/components/primitives';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  activateSaleAgreement,
  cancelSaleAgreement,
  completeSaleAgreement,
  getSaleAgreement,
  saleAgreementStatusLabel,
  saleAgreementStatusTone,
  type PublicSaleAgreement,
} from '@/lib/owner/sale-agreements';
import Link from 'next/link';

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

export function SaleAgreementDetailPage({
  agreementId,
  listHref,
  paymentsHref,
}: {
  agreementId: string;
  listHref: string;
  paymentsHref: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [row, setRow] = useState<PublicSaleAgreement | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRow(await getSaleAgreement(agreementId));
      setError(null);
    } catch (err) {
      setRow(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le dossier.',
      );
    } finally {
      setLoading(false);
    }
  }, [agreementId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  const run = async (
    action: () => Promise<PublicSaleAgreement>,
    label: string,
  ): Promise<void> => {
    if (!confirm(`${label} ?`)) return;
    setBusy(true);
    try {
      setRow(await action());
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Action impossible.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }
  if (!row) {
    return (
      <p className="text-sm text-danger" role="alert">
        {error ?? 'Dossier introuvable.'}
      </p>
    );
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={row.propertyTitle}
        actions={
          <Link href={listHref} className="text-sm text-accent hover:underline">
            ← Dossiers
          </Link>
        }
      />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge
          label={saleAgreementStatusLabel(row.status)}
          tone={saleAgreementStatusTone(row.status)}
        />
        <p className="text-sm text-muted">
          {row.buyerName ?? 'Acheteur'} · {row.buyerPhone ?? '—'} ·{' '}
          {formatMoney(row.agreedPrice, row.currency)}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {row.status === 'DRAFT' ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => activateSaleAgreement(row.id),
                'Activer ce dossier (le bien passera en offre)',
              )
            }
          >
            Activer
          </Button>
        ) : null}
        {row.status === 'ACTIVE' ? (
          <Button
            type="button"
            disabled={busy}
            onClick={() =>
              void run(
                () => completeSaleAgreement(row.id),
                'Marquer ce dossier comme terminé',
              )
            }
          >
            Terminer
          </Button>
        ) : null}
        {row.status === 'DRAFT' || row.status === 'ACTIVE' ? (
          <Button
            type="button"
            variant="danger"
            disabled={busy}
            onClick={() =>
              void run(
                () => cancelSaleAgreement(row.id),
                'Annuler ce dossier',
              )
            }
          >
            Annuler
          </Button>
        ) : null}
      </div>

      <div className="space-y-2">
        <h2 className="text-base font-semibold">Paliers</h2>
        <ul className="divide-y divide-border rounded-lg border border-border bg-card">
          {row.installments.map((i) => (
            <li
              key={i.id}
              className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {i.label || `Palier ${i.position + 1}`}
                </p>
                <p className="text-muted">Échéance {formatDate(i.dueDate)}</p>
              </div>
              <div className="text-right">
                <p className="font-medium">
                  {formatMoney(i.amount, i.currency)}
                </p>
                <p className="text-muted">{i.status}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          L’acheteur paie depuis l’app mobile. Validez les paiements cash dans{' '}
          <Link href={paymentsHref} className="text-accent underline">
            Paiements
          </Link>
          .
        </p>
      </div>
    </section>
  );
}
