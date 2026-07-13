'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import { createLease } from '@/lib/owner/leases';
import { listMyProperties } from '@/lib/owner/properties';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

export function OwnerLeaseForm(): React.JSX.Element {
  const router = useRouter();
  const { ready } = useRequireSession();
  const [properties, setProperties] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    void (async () => {
      try {
        const props = await listMyProperties();
        setProperties(props.map((p) => ({ id: p.id, title: p.title })));
        if (props[0]) setPropertyId(props[0].id);
      } catch {
        // optional prefill
      }
    })();
  }, [ready]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setSubmitting(true);
      setError(null);
      try {
        const lease = await createLease({
          propertyId: propertyId.trim(),
          tenantId: tenantId.trim(),
          startDate,
          endDate,
          monthlyRent: Number(monthlyRent),
          deposit: Number(deposit),
          currency,
        });
        router.push(ROUTES.owner.lease(lease.id));
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de créer le bail.',
        );
        setSubmitting(false);
      }
    },
    [
      currency,
      deposit,
      endDate,
      monthlyRent,
      propertyId,
      router,
      startDate,
      tenantId,
    ],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement de la session…</p>;
  }

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Créer un bail"
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Baux', href: ROUTES.owner.leases },
          { label: 'Créer' },
        ]}
      />

      {error ? (
        <div
          role="alert"
          className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-w-2xl space-y-4 rounded-md border border-border bg-card p-5"
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muted">Bien</span>
          <select
            value={propertyId}
            onChange={(e) => setPropertyId(e.target.value)}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2"
          >
            {properties.length === 0 ? (
              <option value="">Aucun bien — créez-en un d’abord</option>
            ) : null}
            {properties.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-muted">Locataire (ID utilisateur)</span>
          <input
            value={tenantId}
            onChange={(e) => setTenantId(e.target.value)}
            required
            placeholder="UUID du compte locataire"
            className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
          />
          <span className="mt-1 block text-xs text-muted">
            Le locataire doit déjà avoir un compte sur Paradis Immo.
          </span>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Début</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Fin</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Loyer mensuel</span>
            <input
              type="number"
              min={0}
              value={monthlyRent}
              onChange={(e) => setMonthlyRent(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Caution</span>
            <input
              type="number"
              min={0}
              value={deposit}
              onChange={(e) => setDeposit(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Devise</span>
            <input
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
        </div>

        <div className="flex flex-wrap gap-2 pt-2">
          <button
            type="submit"
            disabled={submitting || !propertyId}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
          >
            {submitting ? 'Création…' : 'Créer le bail'}
          </button>
          <button
            type="button"
            onClick={() => router.push(ROUTES.owner.leases)}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-muted hover:bg-card-hover"
          >
            Annuler
          </button>
        </div>
      </form>
    </section>
  );
}
