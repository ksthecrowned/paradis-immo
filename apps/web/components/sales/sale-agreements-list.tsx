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
  listSaleAgreements,
  saleAgreementStatusLabel,
  saleAgreementStatusTone,
  type PublicSaleAgreement,
} from '@/lib/owner/sale-agreements';
import Link from 'next/link';

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function SaleAgreementsListPage({
  addHref,
  detailHref,
  inquiriesHref,
}: {
  addHref: string;
  detailHref: (id: string) => string;
  /** Optional link back to sale inquiries (agent). */
  inquiriesHref?: string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const [rows, setRows] = useState<PublicSaleAgreement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRows(await listSaleAgreements());
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les dossiers.',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [ready, load]);

  return (
    <section className="space-y-4">
      <DashboardPageHeader
        title="Dossiers vente"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {inquiriesHref ? (
              <Link
                href={inquiriesHref}
                className="text-sm font-medium text-accent hover:underline"
              >
                Demandes
              </Link>
            ) : null}
            <Link href={addHref}>
              <Button type="button">Nouveau dossier</Button>
            </Link>
          </div>
        }
      />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Aucun dossier vente.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3"
            >
              <div>
                <Link
                  href={detailHref(row.id)}
                  className="font-medium text-accent hover:underline"
                >
                  {row.propertyTitle}
                </Link>
                <p className="text-sm text-muted">
                  {row.buyerName ?? row.buyerPhone ?? 'Acheteur'} ·{' '}
                  {formatMoney(row.agreedPrice, row.currency)}
                </p>
              </div>
              <StatusBadge
                label={saleAgreementStatusLabel(row.status)}
                tone={saleAgreementStatusTone(row.status)}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
