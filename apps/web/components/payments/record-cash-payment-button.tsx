'use client';

import { Button } from '@/components/primitives';
import { ApiError } from '@/lib/api';
import { recordCashPayment } from '@/lib/owner/payments';
import { useState } from 'react';

function formatMoney(amount: string | number, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export type RecordCashPaymentButtonProps = {
  rentScheduleId?: string;
  saleInstallmentId?: string;
  amount: string | number;
  currency: string;
  dueDateLabel?: string;
  size?: 'sm' | 'md';
  variant?: 'primary' | 'secondary';
  label?: string;
  onRecorded?: () => void | Promise<void>;
  onError?: (message: string) => void;
};

export function RecordCashPaymentButton({
  rentScheduleId,
  saleInstallmentId,
  amount,
  currency,
  dueDateLabel,
  size = 'sm',
  variant = 'primary',
  label = 'Enregistrer espèces',
  onRecorded,
  onError,
}: RecordCashPaymentButtonProps): React.JSX.Element {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (!rentScheduleId && !saleInstallmentId) return;
    const money = formatMoney(amount, currency);
    const detail = dueDateLabel ? ` (échéance ${dueDateLabel})` : '';
    if (
      !confirm(
        `Enregistrer un paiement espèces de ${money}${detail} ?\n\nLe paiement sera validé immédiatement.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await recordCashPayment({
        rentScheduleId,
        saleInstallmentId,
        amount: Number(amount),
        currency,
        idempotencyKey: rentScheduleId
          ? `cash-rent-${rentScheduleId}`
          : `cash-sale-${saleInstallmentId}`,
      });
      await onRecorded?.();
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : "Impossible d'enregistrer le paiement espèces.";
      onError?.(message);
      if (!onError) {
        window.alert(message);
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      loading={busy}
      onClick={() => void handleClick()}
    >
      {label}
    </Button>
  );
}
