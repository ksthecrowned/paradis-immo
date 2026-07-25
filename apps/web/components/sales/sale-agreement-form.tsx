'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { DashboardPageHeader } from '@/components/dashboard';
import { Button } from '@/components/primitives';
import {
  PhoneInput,
  getPhoneE164,
  isPhoneComplete,
} from '@/components/forms';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  DEFAULT_PHONE_COUNTRY,
  type PhoneCountrySelection,
} from '@/lib/phone';
import { listMyProperties, type PublicProperty } from '@/lib/owner/properties';
import {
  createSaleAgreement,
  type SaleInstallmentInput,
} from '@/lib/owner/sale-agreements';
import { useRouter, useSearchParams } from 'next/navigation';

type Row = SaleInstallmentInput & { key: string };

export function SaleAgreementFormPage({
  listHref,
  detailHref,
}: {
  listHref: string;
  detailHref: (id: string) => string;
}): React.JSX.Element {
  const { ready } = useRequireSession();
  const router = useRouter();
  const search = useSearchParams();
  const inquiryId = search.get('saleInquiryId') ?? undefined;
  const prefillPropertyId = search.get('propertyId') ?? '';

  const [properties, setProperties] = useState<PublicProperty[]>([]);
  const [propertyId, setPropertyId] = useState(prefillPropertyId);
  const [phoneCountry, setPhoneCountry] =
    useState<PhoneCountrySelection>(DEFAULT_PHONE_COUNTRY);
  const [buyerPhone, setBuyerPhone] = useState('');
  const [buyerName, setBuyerName] = useState('');
  const [agreedPrice, setAgreedPrice] = useState('');
  const [rows, setRows] = useState<Row[]>([
    {
      key: '1',
      label: 'Apport',
      dueDate: new Date().toISOString().slice(0, 10),
      amount: 0,
    },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      const all = await listMyProperties();
      setProperties(all.filter((p) => p.mode === 'SALE'));
    })();
  }, [ready]);

  useEffect(() => {
    if (prefillPropertyId) setPropertyId(prefillPropertyId);
  }, [prefillPropertyId]);

  const sum = useMemo(
    () => rows.reduce((acc, r) => acc + Number(r.amount || 0), 0),
    [rows],
  );
  const priceNum = Number(agreedPrice || 0);
  const remainder = priceNum - sum;

  const distributeRemainder = useCallback(() => {
    if (rows.length === 0) return;
    const next = [...rows];
    const last = next[next.length - 1]!;
    last.amount = Math.max(0, Number(last.amount || 0) + remainder);
    setRows(next);
  }, [rows, remainder]);

  const submit = async (): Promise<void> => {
    setBusy(true);
    setError(null);
    try {
      if (!inquiryId) {
        if (!isPhoneComplete(buyerPhone, phoneCountry)) {
          setError('Numéro de téléphone acheteur invalide.');
          setBusy(false);
          return;
        }
      }
      const e164 = inquiryId
        ? undefined
        : getPhoneE164(buyerPhone, phoneCountry);
      if (!inquiryId && !e164) {
        setError('Numéro de téléphone acheteur invalide.');
        setBusy(false);
        return;
      }
      const created = await createSaleAgreement({
        propertyId,
        ...(inquiryId
          ? { saleInquiryId: inquiryId }
          : {
              buyerPhone: e164!,
              buyerName: buyerName.trim() || undefined,
            }),
        agreedPrice: priceNum,
        currency: 'XAF',
        installments: rows.map((r) => ({
          label: r.label || undefined,
          dueDate: new Date(r.dueDate).toISOString(),
          amount: Number(r.amount),
        })),
      });
      router.push(detailHref(created.id));
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de créer le dossier.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="mx-auto max-w-2xl space-y-4">
      <DashboardPageHeader title="Nouveau dossier vente" />
      {error ? (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      ) : null}

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Bien</span>
        <select
          className="w-full rounded-lg border border-border bg-card px-3 py-2"
          value={propertyId}
          onChange={(e) => setPropertyId(e.target.value)}
        >
          <option value="">Choisir…</option>
          {properties.map((p) => (
            <option key={p.id} value={p.id}>
              {p.title}
            </option>
          ))}
        </select>
      </label>

      {!inquiryId ? (
        <>
          <PhoneInput
            label="Téléphone acheteur"
            value={buyerPhone}
            country={phoneCountry}
            onCountryChange={setPhoneCountry}
            onChange={setBuyerPhone}
            required
          />
          <label className="block space-y-1 text-sm">
            <span className="text-muted">Nom acheteur</span>
            <input
              className="w-full rounded-lg border border-border bg-card px-3 py-2"
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
            />
          </label>
        </>
      ) : (
        <p className="text-sm text-muted">
          Dossier lié à une demande d’achat ({inquiryId.slice(0, 8)}…).
        </p>
      )}

      <label className="block space-y-1 text-sm">
        <span className="text-muted">Prix convenu (XAF)</span>
        <input
          type="number"
          className="w-full rounded-lg border border-border bg-card px-3 py-2"
          value={agreedPrice}
          onChange={(e) => setAgreedPrice(e.target.value)}
        />
      </label>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">Paliers</h2>
          <Button
            type="button"
            variant="secondary"
            onClick={distributeRemainder}
            disabled={rows.length === 0 || remainder === 0}
          >
            Répartir le reste ({remainder.toLocaleString('fr-FR')})
          </Button>
        </div>
        {rows.map((row, index) => (
          <div
            key={row.key}
            className="grid gap-2 rounded-lg border border-border p-3 sm:grid-cols-3"
          >
            <input
              placeholder="Libellé"
              className="rounded border border-border px-2 py-1.5 text-sm"
              value={row.label ?? ''}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, label: e.target.value };
                setRows(next);
              }}
            />
            <input
              type="date"
              className="rounded border border-border px-2 py-1.5 text-sm"
              value={row.dueDate.slice(0, 10)}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, dueDate: e.target.value };
                setRows(next);
              }}
            />
            <input
              type="number"
              placeholder="Montant"
              className="rounded border border-border px-2 py-1.5 text-sm"
              value={row.amount || ''}
              onChange={(e) => {
                const next = [...rows];
                next[index] = { ...row, amount: Number(e.target.value) };
                setRows(next);
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="ghost"
          onClick={() =>
            setRows((prev) => [
              ...prev,
              {
                key: String(Date.now()),
                label: '',
                dueDate: new Date().toISOString().slice(0, 10),
                amount: 0,
              },
            ])
          }
        >
          + Ajouter un palier
        </Button>
        <p className="text-xs text-muted">
          Total paliers : {sum.toLocaleString('fr-FR')} XAF
        </p>
      </div>

      <div className="flex gap-2">
        <Button
          type="button"
          disabled={busy || !propertyId || !agreedPrice}
          onClick={() => void submit()}
        >
          Créer le brouillon
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push(listHref)}
        >
          Annuler
        </Button>
      </div>
    </section>
  );
}
