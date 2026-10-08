'use client';

import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  getPaymentTimeline,
  disputeStatusLabel,
  type PaymentTimeline,
} from '@/lib/disputes';

function formatDateTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

function timelineEventLabel(kind: string): string {
  return (
    {
      PAYMENT_CREATED: 'Paiement créé',
      PAYMENT_VALIDATED: 'Paiement validé',
      PAYMENT_FAILED: 'Paiement échoué',
      PAYMENT_EXPIRED: 'Paiement expiré',
      PAYMENT_CANCELLED: 'Paiement annulé',
      REFUND_REQUESTED: 'Remboursement demandé',
      REFUND_PROCESSED: 'Remboursement exécuté',
      REFUND_FAILED: 'Remboursement échoué',
      DISPUTE_OPENED: 'Litige ouvert',
      DISPUTE_RESOLVED: 'Litige résolu',
    }[kind] ?? kind
  );
}

interface PaymentTimelineProps {
  paymentId: string;
}

/**
 * Spec 05 US « timeline » — chronological payment history: provider events,
 * refunds and disputes.
 */
export function PaymentTimeline({
  paymentId,
}: PaymentTimelineProps): React.JSX.Element {
  const [timeline, setTimeline] = useState<PaymentTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPaymentTimeline(paymentId);
      setTimeline(data);
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger la chronologie.',
      );
    } finally {
      setLoading(false);
    }
  }, [paymentId]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows: { key: string; label: string; at: string; meta: string }[] = [
    ...(timeline?.events ?? []).map((event) => ({
      key: `evt-${event.id}`,
      label: timelineEventLabel(event.kind),
      at: event.createdAt,
      meta: [
        event.provider,
        event.signatureValid === false ? 'signature invalide' : null,
      ]
        .filter(Boolean)
        .join(' · '),
    })),
    ...(timeline?.refunds ?? []).map((refund) => ({
      key: `refund-${refund.id}`,
      label: `Remboursement ${refund.status}`,
      at: refund.createdAt,
      meta: `${refund.amount} · ${refund.reason}`,
    })),
    ...(timeline?.disputes ?? []).map((dispute) => ({
      key: `dispute-${dispute.id}`,
      label: `Litige : ${disputeStatusLabel(dispute.status)}`,
      at: dispute.createdAt,
      meta: dispute.description,
    })),
  ].sort((a, b) => a.at.localeCompare(b.at));

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-medium">Chronologie</h2>
      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}
      {loading ? (
        <p className="text-sm text-muted">Chargement…</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted">Aucun événement enregistré.</p>
      ) : (
        <ol className="space-y-3 border-l border-border pl-4">
          {rows.map((row) => (
            <li key={row.key} className="relative text-sm">
              <span
                aria-hidden
                className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-accent"
              />
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-medium">{row.label}</span>
                <span className="text-xs text-muted">
                  {formatDateTime(row.at)}
                </span>
              </div>
              {row.meta ? (
                <p className="text-xs text-muted">{row.meta}</p>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
