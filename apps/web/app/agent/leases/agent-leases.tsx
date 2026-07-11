'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import {
  DashboardPageHeader,
  ListDataTable,
  StatusBadge,
  type ListColumn,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  activateLease,
  createLease,
  listManagedLeases,
  requestLeaseSign,
  type PublicLease,
} from '@/lib/agent/leases';
import { leaseStatusLabel, leaseStatusTone } from '@/lib/owner/leases';
import { useRequireSession } from '@/hooks/use-require-session';

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export function AgentLeasesPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [propertyId, setPropertyId] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [monthlyRent, setMonthlyRent] = useState('');
  const [deposit, setDeposit] = useState('');
  const [currency, setCurrency] = useState('XAF');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<PublicLease | null>(null);

  const [leases, setLeases] = useState<PublicLease[]>([]);
  const [loadingLeases, setLoadingLeases] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadLeases = useCallback(async () => {
    setLoadingLeases(true);
    try {
      const data = await listManagedLeases();
      setLeases(data);
    } catch {
      setLeases([]);
    } finally {
      setLoadingLeases(false);
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    void loadLeases();
  }, [loadLeases, ready]);

  async function handleSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setCreated(null);
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
      setCreated(lease);
      await loadLeases();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de créer le bail.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const handleRequestSign = useCallback(
    async (leaseId: string) => {
      if (!confirm('Demander la signature du propriétaire pour ce bail ?')) return;
      setActionId(leaseId);
      setError(null);
      try {
        await requestLeaseSign(leaseId);
        await loadLeases();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible de demander la signature.',
        );
      } finally {
        setActionId(null);
      }
    },
    [loadLeases],
  );

  const handleActivate = useCallback(
    async (leaseId: string) => {
      if (!confirm('Activer ce bail et générer l’échéancier ?')) return;
      setActionId(leaseId);
      setError(null);
      try {
        await activateLease(leaseId);
        await loadLeases();
      } catch (err) {
        setError(
          err instanceof ApiError
            ? err.message
            : 'Impossible d’activer le bail.',
        );
      } finally {
        setActionId(null);
      }
    },
    [loadLeases],
  );

  const columns = useMemo<ListColumn<PublicLease>[]>(
    () => [
      {
        key: 'propertyId',
        label: 'Bien',
        render: (value) => (
          <span className="font-mono text-xs">{String(value).slice(0, 10)}…</span>
        ),
      },
      {
        key: 'tenantId',
        label: 'Locataire',
        className: 'hidden md:table-cell',
        render: (value) => (
          <span className="font-mono text-xs">{String(value).slice(0, 10)}…</span>
        ),
      },
      {
        key: 'startDate',
        label: 'Début',
        sortable: true,
        render: (value) => formatDate(String(value)),
      },
      {
        key: 'status',
        label: 'Statut',
        sortable: true,
        render: (value) => (
          <StatusBadge
            label={leaseStatusLabel(String(value))}
            tone={leaseStatusTone(String(value))}
          />
        ),
      },
    ],
    [],
  );

  if (!ready) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  return (
    <section className="space-y-8">
      <DashboardPageHeader title="Baux" />

      {error ? (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </div>
      ) : null}

      {created ? (
        <div className="rounded-xl border border-success/40 bg-success/10 px-4 py-3 text-sm text-foreground">
          <p className="font-medium">Bail créé (brouillon)</p>
          <p className="mt-1 font-mono text-xs text-muted">ID : {created.id}</p>
          {created.mandateApprovalId ? (
            <p className="mt-2 text-muted">
              Approbation mandat requise ({created.mandateApprovalId.slice(0, 8)}…).
            </p>
          ) : (
            <p className="mt-2 text-muted">
              Demandez la signature propriétaire si le bien est mandaté, puis activez.
            </p>
          )}
        </div>
      ) : null}

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="max-w-2xl space-y-4 rounded-md border border-border bg-card p-5"
      >
        <h2 className="text-base font-semibold text-heading">Créer un bail</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">ID du bien</span>
            <input
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              required
              placeholder="prop_…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block text-muted">ID du locataire</span>
            <input
              value={tenantId}
              onChange={(e) => setTenantId(e.target.value)}
              required
              placeholder="user_…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 font-mono text-sm"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Date de début</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muted">Date de fin</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            />
          </label>
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
            <span className="mb-1 block text-muted">Dépôt de garantie</span>
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
        <button
          type="submit"
          disabled={submitting}
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
        >
          {submitting ? 'Création…' : 'Créer le bail'}
        </button>
      </form>

      <section className="space-y-4">
        <h2 className="text-base font-semibold text-heading">Baux gérés</h2>
        <ListDataTable
          data={leases}
          columns={columns}
          loading={loadingLeases}
          onRefresh={loadLeases}
          entityLabel="baux"
          searchPlaceholder="Rechercher un bail…"
          emptyMessage="Aucun bail pour le moment."
          tableId="agent-leases-table"
          actions={(row) =>
            row.status === 'DRAFT' ? (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={() => void handleRequestSign(row.id)}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-card-hover disabled:opacity-50"
                >
                  Demander signature
                </button>
                <button
                  type="button"
                  disabled={actionId === row.id}
                  onClick={() => void handleActivate(row.id)}
                  className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-white hover:bg-accent/90 disabled:opacity-50"
                >
                  Activer
                </button>
              </div>
            ) : null
          }
        />
      </section>
    </section>
  );
}
