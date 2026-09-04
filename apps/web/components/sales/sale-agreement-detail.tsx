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
  getBuyerPaymentProofEligibility,
  getLatestBuyerPaymentProof,
  proofKindLabel,
  requestBuyerPaymentProof,
  type PublicBuyerPaymentProof,
} from '@/lib/owner/buyer-payment-proofs';
import {
  activateSaleAgreement,
  cancelSaleAgreement,
  canRecordSaleInstallmentCash,
  completeSaleAgreement,
  getSaleAgreement,
  saleAgreementStatusLabel,
  saleAgreementStatusTone,
  saleInstallmentStatusLabel,
  type PublicSaleAgreement,
} from '@/lib/owner/sale-agreements';
import { RecordCashPaymentButton } from '@/components/payments/record-cash-payment-button';
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

function errorCode(err: unknown): string | null {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== 'object') {
    return null;
  }
  const code = (err.body as { code?: unknown }).code;
  return typeof code === 'string' ? code : null;
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
  const [paymentProof, setPaymentProof] =
    useState<PublicBuyerPaymentProof | null>(null);
  const [paymentProofBusy, setPaymentProofBusy] = useState(false);
  const [paymentProofHint, setPaymentProofHint] = useState<string | null>(null);
  const [canRequestProof, setCanRequestProof] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const agreement = await getSaleAgreement(agreementId);
      setRow(agreement);
      try {
        const [latest, eligibility] = await Promise.all([
          getLatestBuyerPaymentProof(agreementId),
          getBuyerPaymentProofEligibility(agreementId),
        ]);
        setPaymentProof(latest);
        setCanRequestProof(eligibility.eligible);
        if (
          !eligibility.eligible &&
          eligibility.reason === 'NO_PAID_PAYMENTS'
        ) {
          setPaymentProofHint(
            'Aucun paiement effectué sur la plateforme pour cet acheteur.',
          );
        } else {
          setPaymentProofHint(null);
        }
      } catch {
        setPaymentProof(null);
        setCanRequestProof(true);
      }
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

  const handleRequestPaymentProof = useCallback(async () => {
    setPaymentProofBusy(true);
    setPaymentProofHint(null);
    try {
      setPaymentProof(await requestBuyerPaymentProof(agreementId));
      setCanRequestProof(true);
    } catch (err) {
      if (errorCode(err) === 'NO_PAID_PAYMENTS') {
        setCanRequestProof(false);
        setPaymentProofHint(
          'Aucun paiement effectué sur la plateforme pour cet acheteur.',
        );
      } else {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de demander la preuve de paiements.',
        );
      }
    } finally {
      setPaymentProofBusy(false);
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
              className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-medium">
                  {i.label || `Palier ${i.position + 1}`}
                </p>
                <p className="text-muted">Échéance {formatDate(i.dueDate)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <div className="text-right">
                  <p className="font-medium">
                    {formatMoney(i.amount, i.currency)}
                  </p>
                  <p className="text-muted">
                    {saleInstallmentStatusLabel(i.status)}
                  </p>
                </div>
                {row.status === 'ACTIVE' &&
                canRecordSaleInstallmentCash(i.status) ? (
                  <RecordCashPaymentButton
                    saleInstallmentId={i.id}
                    amount={i.amount}
                    currency={i.currency}
                    dueDateLabel={formatDate(i.dueDate)}
                    onRecorded={load}
                    onError={setError}
                  />
                ) : null}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-muted">
          Mobile Money via l’app acheteur ; espèces enregistrées ici ou dans{' '}
          <Link href={paymentsHref} className="text-accent underline">
            Paiements
          </Link>
          .
        </p>
      </div>

      {row.status !== 'CANCELLED' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Preuve sur dossier vente
            </h2>
            {!paymentProof ||
            paymentProof.status === 'DENIED' ||
            paymentProof.status === 'EXPIRED' ||
            (paymentProof.status === 'GRANTED' &&
              (!paymentProof.expiresAt ||
                new Date(paymentProof.expiresAt).getTime() <= Date.now())) ? (
              <Button
                type="button"
                variant="secondary"
                disabled={paymentProofBusy || !canRequestProof}
                onClick={() => void handleRequestPaymentProof()}
              >
                Demander la preuve de paiements
              </Button>
            ) : null}
          </div>
          {paymentProofHint ? (
            <p className="text-sm text-muted">{paymentProofHint}</p>
          ) : null}
          {!paymentProof ? (
            <p className="text-sm text-muted">
              Demandez l’accès aux paiements de l’acheteur pour ce dossier.
            </p>
          ) : null}
          {paymentProof?.status === 'PENDING' ? (
            <p className="text-sm text-muted">
              En attente de la réponse de l’acheteur
            </p>
          ) : null}
          {paymentProof?.status === 'DENIED' ? (
            <p className="text-sm text-muted">
              L’acheteur a refusé la dernière demande.
            </p>
          ) : null}
          {paymentProof?.status === 'EXPIRED' ? (
            <p className="text-sm text-muted">
              L’accès précédent a expiré. Vous pouvez redemander.
            </p>
          ) : null}
          {paymentProof?.status === 'GRANTED' &&
          paymentProof.snapshot &&
          paymentProof.expiresAt &&
          new Date(paymentProof.expiresAt).getTime() > Date.now() ? (
            <div className="space-y-2">
              <p className="text-sm text-muted">
                Expire le {formatDate(paymentProof.expiresAt)}
              </p>
              <div className="overflow-x-auto rounded-lg border border-border bg-card">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border text-xs text-muted">
                    <tr>
                      <th className="px-4 py-3 font-medium">Type</th>
                      <th className="px-4 py-3 font-medium">Échéance</th>
                      <th className="px-4 py-3 font-medium">Montant</th>
                      <th className="px-4 py-3 font-medium">Retard (jours)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {paymentProof.snapshot.map((item) => (
                      <tr key={`${item.kind}-${item.dueDate}-${item.paidAt}`}>
                        <td className="px-4 py-3 font-medium">
                          {proofKindLabel(item.kind)}
                        </td>
                        <td className="px-4 py-3">
                          {formatDate(item.dueDate)}
                        </td>
                        <td className="px-4 py-3">
                          {formatMoney(item.amount, item.currency)}
                        </td>
                        <td className="px-4 py-3">{item.daysLate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
