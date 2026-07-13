'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { DashboardPageHeader, StatusBadge } from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  getPayment,
  getPaymentReceipt,
  paymentStatusLabel,
  paymentStatusTone,
  validatePayment,
  type PublicPayment,
} from '@/lib/owner/payments';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

export interface OwnerPaymentDetailProps {
  paymentId: string;
}

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

export function OwnerPaymentDetail({
  paymentId,
}: OwnerPaymentDetailProps): React.JSX.Element {
  const { ready } = useRequireSession();
  const [payment, setPayment] = useState<PublicPayment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayment(paymentId);
      setPayment(data);
      setError(null);
    } catch (err) {
      setPayment(null);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le paiement.',
      );
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleValidate = useCallback(async () => {
    if (!payment) return;
    if (
      !confirm(
        `Valider le paiement de ${formatMoney(payment.amount, payment.currency)} ?`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await validatePayment(payment.id);
      await load();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de valider le paiement.',
      );
    } finally {
      setBusy(false);
    }
  }, [load, payment]);

  const handleReceipt = useCallback(async () => {
    setBusy(true);
    try {
      const receipt = await getPaymentReceipt(paymentId);
      window.open(receipt.url, '_blank', 'noopener,noreferrer');
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’ouvrir le reçu.',
      );
    } finally {
      setBusy(false);
    }
  }, [paymentId]);

  if (!ready || loading) {
    return (
      <section className="space-y-4">
        <p className="text-sm text-muted">Chargement…</p>
      </section>
    );
  }

  if (!payment) {
    return (
      <section className="space-y-4">
        {error ? (
          <div
            role="alert"
            className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
          >
            {error}
          </div>
        ) : null}
        <Link href={ROUTES.owner.payments} className="text-sm text-accent">
          ← Retour aux paiements
        </Link>
      </section>
    );
  }

  const canValidate =
    payment.method === 'CASH' && payment.status === 'PENDING_VALIDATION';
  const shortId = `${payment.id.slice(0, 8)}…`;

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={payment.reference}
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Paiements', href: ROUTES.owner.payments },
          { label: shortId },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={paymentStatusLabel(payment.status)}
              tone={paymentStatusTone(payment.status)}
            />
            {canValidate ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleValidate()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {busy ? 'Validation…' : 'Valider le paiement'}
              </button>
            ) : null}
            {payment.status === 'VALIDATED' ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleReceipt()}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover disabled:opacity-50"
              >
                Ouvrir le reçu
              </button>
            ) : null}
            <Link
              href={ROUTES.owner.payments}
              className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-card-hover"
            >
              Liste
            </Link>
          </div>
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

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-muted">Montant</dt>
          <dd>{formatMoney(payment.amount, payment.currency)}</dd>
        </div>
        <div>
          <dt className="text-muted">Méthode</dt>
          <dd>{payment.method === 'CASH' ? 'Espèces' : 'Mobile money'}</dd>
        </div>
        <div>
          <dt className="text-muted">Payeur</dt>
          <dd className="font-mono text-xs">{payment.userId}</dd>
        </div>
        <div>
          <dt className="text-muted">Créé le</dt>
          <dd>{formatDate(payment.createdAt)}</dd>
        </div>
        {payment.validatedAt ? (
          <div>
            <dt className="text-muted">Validé le</dt>
            <dd>{formatDate(payment.validatedAt)}</dd>
          </div>
        ) : null}
        {payment.validatedBy ? (
          <div>
            <dt className="text-muted">Validé par</dt>
            <dd className="font-mono text-xs">{payment.validatedBy}</dd>
          </div>
        ) : null}
      </dl>

      {(payment.allocations?.length ?? 0) > 0 ? (
        <div className="space-y-2">
          <h2 className="text-sm font-medium">Allocations</h2>
          <ul className="space-y-1 text-sm">
            {payment.allocations!.map((a) => (
              <li key={a.id} className="font-mono text-xs">
                {a.type} · {a.amount} · {a.rentScheduleId ?? a.refId}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
