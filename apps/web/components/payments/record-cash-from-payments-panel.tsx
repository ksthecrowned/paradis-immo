'use client';

import { Button } from '@/components/primitives';
import { RecordCashPaymentButton } from '@/components/payments/record-cash-payment-button';
import { ApiError } from '@/lib/api';
import {
  getLeaseSchedule,
  listManagedLeases,
  rentScheduleStatusLabel,
  type PublicLease,
  type PublicRentScheduleEntry,
} from '@/lib/owner/leases';
import {
  canRecordSaleInstallmentCash,
  listSaleAgreements,
  saleInstallmentStatusLabel,
  type PublicSaleAgreement,
  type PublicSaleInstallment,
} from '@/lib/owner/sale-agreements';
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

const RECORDABLE_RENT = new Set(['PENDING', 'OVERDUE', 'PARTIAL']);

type Kind = 'rent' | 'sale';

export type RecordCashFromPaymentsPanelProps = {
  onRecorded?: () => void | Promise<void>;
  onError?: (message: string) => void;
};

export function RecordCashFromPaymentsPanel({
  onRecorded,
  onError,
}: RecordCashFromPaymentsPanelProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>('rent');

  const [leases, setLeases] = useState<PublicLease[]>([]);
  const [leaseId, setLeaseId] = useState('');
  const [schedule, setSchedule] = useState<PublicRentScheduleEntry[]>([]);
  const [scheduleId, setScheduleId] = useState('');
  const [loadingLeases, setLoadingLeases] = useState(false);
  const [loadingSchedule, setLoadingSchedule] = useState(false);

  const [agreements, setAgreements] = useState<PublicSaleAgreement[]>([]);
  const [agreementId, setAgreementId] = useState('');
  const [installmentId, setInstallmentId] = useState('');
  const [loadingSales, setLoadingSales] = useState(false);

  const reset = () => {
    setLeaseId('');
    setScheduleId('');
    setSchedule([]);
    setAgreementId('');
    setInstallmentId('');
  };

  const loadLeases = useCallback(async () => {
    setLoadingLeases(true);
    try {
      const rows = await listManagedLeases();
      setLeases(rows.filter((l) => l.status === 'ACTIVE'));
    } catch (err) {
      onError?.(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les baux.',
      );
    } finally {
      setLoadingLeases(false);
    }
  }, [onError]);

  const loadSales = useCallback(async () => {
    setLoadingSales(true);
    try {
      const rows = await listSaleAgreements();
      setAgreements(rows.filter((a) => a.status === 'ACTIVE'));
    } catch (err) {
      onError?.(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger les dossiers vente.',
      );
    } finally {
      setLoadingSales(false);
    }
  }, [onError]);

  useEffect(() => {
    if (!open) return;
    if (kind === 'rent') void loadLeases();
    else void loadSales();
  }, [open, kind, loadLeases, loadSales]);

  useEffect(() => {
    if (kind !== 'rent' || !leaseId) {
      if (kind !== 'rent') {
        setSchedule([]);
        setScheduleId('');
      }
      return;
    }
    let cancelled = false;
    setLoadingSchedule(true);
    void getLeaseSchedule(leaseId)
      .then((rows) => {
        if (cancelled) return;
        const unpaid = rows.filter((r) => RECORDABLE_RENT.has(r.status));
        setSchedule(unpaid);
        setScheduleId(unpaid[0]?.id ?? '');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        onError?.(
          err instanceof ApiError
            ? err.message
            : "Impossible de charger l'échéancier.",
        );
        setSchedule([]);
        setScheduleId('');
      })
      .finally(() => {
        if (!cancelled) setLoadingSchedule(false);
      });
    return () => {
      cancelled = true;
    };
  }, [kind, leaseId, onError]);

  useEffect(() => {
    if (kind !== 'sale' || !agreementId) {
      setInstallmentId('');
      return;
    }
    const agreement = agreements.find((a) => a.id === agreementId);
    const openRows =
      agreement?.installments.filter((i) =>
        canRecordSaleInstallmentCash(i.status),
      ) ?? [];
    setInstallmentId(openRows[0]?.id ?? '');
  }, [kind, agreementId, agreements]);

  const selectedRent = useMemo(
    () => schedule.find((s) => s.id === scheduleId) ?? null,
    [schedule, scheduleId],
  );

  const selectedSaleInstallment = useMemo((): PublicSaleInstallment | null => {
    const agreement = agreements.find((a) => a.id === agreementId);
    return (
      agreement?.installments.find((i) => i.id === installmentId) ?? null
    );
  }, [agreements, agreementId, installmentId]);

  const openSaleInstallments = useMemo(() => {
    const agreement = agreements.find((a) => a.id === agreementId);
    return (
      agreement?.installments.filter((i) =>
        canRecordSaleInstallmentCash(i.status),
      ) ?? []
    );
  }, [agreements, agreementId]);

  const leaseLabel = (lease: PublicLease) => {
    const tenant =
      lease.tenantName?.trim() || lease.tenantPhone?.trim() || 'Locataire';
    return `${tenant} · ${formatMoney(lease.monthlyRent, lease.currency)}/mois`;
  };

  const saleLabel = (a: PublicSaleAgreement) => {
    const buyer = a.buyerName?.trim() || a.buyerPhone?.trim() || 'Acheteur';
    return `${a.propertyTitle} · ${buyer}`;
  };

  return (
    <div className="space-y-3">
      {!open ? (
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setOpen(true)}
        >
          Enregistrer un paiement espèces
        </Button>
      ) : (
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-heading">
              Enregistrer un paiement espèces
            </h3>
            <button
              type="button"
              className="text-xs text-muted hover:text-foreground"
              onClick={() => {
                setOpen(false);
                reset();
              }}
            >
              Fermer
            </button>
          </div>

          <div className="flex gap-2 text-sm">
            <button
              type="button"
              className={[
                'rounded-md px-3 py-1.5 border',
                kind === 'rent'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted',
              ].join(' ')}
              onClick={() => {
                setKind('rent');
                reset();
              }}
            >
              Loyer
            </button>
            <button
              type="button"
              className={[
                'rounded-md px-3 py-1.5 border',
                kind === 'sale'
                  ? 'border-accent bg-accent/10 text-accent'
                  : 'border-border text-muted',
              ].join(' ')}
              onClick={() => {
                setKind('sale');
                reset();
              }}
            >
              Vente
            </button>
          </div>

          {kind === 'rent' ? (
            <>
              <label className="block space-y-1 text-sm">
                <span className="text-muted">Bail actif</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={leaseId}
                  disabled={loadingLeases}
                  onChange={(e) => setLeaseId(e.target.value)}
                >
                  <option value="">
                    {loadingLeases ? 'Chargement…' : 'Choisir un bail'}
                  </option>
                  {leases.map((lease) => (
                    <option key={lease.id} value={lease.id}>
                      {leaseLabel(lease)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="text-muted">Échéance</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={scheduleId}
                  disabled={!leaseId || loadingSchedule}
                  onChange={(e) => setScheduleId(e.target.value)}
                >
                  <option value="">
                    {loadingSchedule
                      ? 'Chargement…'
                      : schedule.length === 0
                        ? 'Aucune échéance à payer'
                        : 'Choisir une échéance'}
                  </option>
                  {schedule.map((row) => (
                    <option key={row.id} value={row.id}>
                      {formatDate(row.dueDate)} ·{' '}
                      {formatMoney(row.amount, row.currency)} ·{' '}
                      {rentScheduleStatusLabel(row.status)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedRent ? (
                <RecordCashPaymentButton
                  rentScheduleId={selectedRent.id}
                  amount={selectedRent.amount}
                  currency={selectedRent.currency}
                  dueDateLabel={formatDate(selectedRent.dueDate)}
                  size="md"
                  onRecorded={async () => {
                    setOpen(false);
                    reset();
                    await onRecorded?.();
                  }}
                  onError={onError}
                />
              ) : null}
            </>
          ) : (
            <>
              <label className="block space-y-1 text-sm">
                <span className="text-muted">Dossier vente actif</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={agreementId}
                  disabled={loadingSales}
                  onChange={(e) => setAgreementId(e.target.value)}
                >
                  <option value="">
                    {loadingSales ? 'Chargement…' : 'Choisir un dossier'}
                  </option>
                  {agreements.map((a) => (
                    <option key={a.id} value={a.id}>
                      {saleLabel(a)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block space-y-1 text-sm">
                <span className="text-muted">Palier</span>
                <select
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                  value={installmentId}
                  disabled={!agreementId}
                  onChange={(e) => setInstallmentId(e.target.value)}
                >
                  <option value="">
                    {openSaleInstallments.length === 0
                      ? 'Aucun palier à payer'
                      : 'Choisir un palier'}
                  </option>
                  {openSaleInstallments.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.label || `Palier ${row.position + 1}`} ·{' '}
                      {formatDate(row.dueDate)} ·{' '}
                      {formatMoney(row.amount, row.currency)} ·{' '}
                      {saleInstallmentStatusLabel(row.status)}
                    </option>
                  ))}
                </select>
              </label>

              {selectedSaleInstallment ? (
                <RecordCashPaymentButton
                  saleInstallmentId={selectedSaleInstallment.id}
                  amount={selectedSaleInstallment.amount}
                  currency={selectedSaleInstallment.currency}
                  dueDateLabel={formatDate(selectedSaleInstallment.dueDate)}
                  size="md"
                  onRecorded={async () => {
                    setOpen(false);
                    reset();
                    await onRecorded?.();
                  }}
                  onError={onError}
                />
              ) : null}
            </>
          )}
        </div>
      )}
    </div>
  );
}
