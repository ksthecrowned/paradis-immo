'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import {
  DashboardPageHeader,
  StatusBadge,
} from '@/components/dashboard';
import { ApiError } from '@/lib/api';
import {
  activateLease,
  getLease,
  getLeaseSchedule,
  leaseStatusLabel,
  leaseStatusTone,
  type PublicLease,
  type PublicRentScheduleEntry,
} from '@/lib/owner/leases';
import { ROUTES } from '@/lib/routes';
import { useRequireSession } from '@/hooks/use-require-session';

export interface OwnerLeaseDetailProps {
  leaseId: string;
}

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

export function OwnerLeaseDetail({
  leaseId,
}: OwnerLeaseDetailProps): React.JSX.Element {
  const { ready } = useRequireSession();
  const [lease, setLease] = useState<PublicLease | null>(null);
  const [schedule, setSchedule] = useState<PublicRentScheduleEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getLease(leaseId);
      setLease(data);
      if (data.status === 'ACTIVE') {
        const rows = await getLeaseSchedule(leaseId);
        setSchedule(rows);
      } else {
        setSchedule([]);
      }
      setError(null);
    } catch (err) {
      setLease(null);
      setSchedule([]);
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible de charger le bail.',
      );
    } finally {
      setLoading(false);
    }
  }, [leaseId]);

  useEffect(() => {
    if (!ready) return;
    void load();
  }, [load, ready]);

  const handleActivate = useCallback(async () => {
    if (!confirm('Activer ce bail et générer l’échéancier de loyers ?')) return;
    setActivating(true);
    try {
      await activateLease(leaseId);
      await load();
      setError(null);
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : 'Impossible d’activer le bail.',
      );
    } finally {
      setActivating(false);
    }
  }, [leaseId, load]);

  if (!ready || loading) {
    return <p className="text-sm text-muted">Chargement…</p>;
  }

  if (!lease) {
    return (
      <section className="space-y-4">
        <DashboardPageHeader title="Détail du bail" />
        <div
          role="alert"
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error ?? 'Bail introuvable.'}
        </div>
        <Link
          href={ROUTES.owner.leases}
          className="inline-block text-sm text-accent hover:underline"
        >
          ← Retour aux baux
        </Link>
      </section>
    );
  }

  const shortId = `${lease.id.slice(0, 8)}…`;

  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title={`Bail ${shortId}`}
        breadcrumb={[
          { label: 'Paradis Immo', href: ROUTES.owner.dashboard },
          { label: 'Baux', href: ROUTES.owner.leases },
          { label: shortId },
        ]}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              label={leaseStatusLabel(lease.status)}
              tone={leaseStatusTone(lease.status)}
            />
            {lease.status === 'DRAFT' ? (
              <button
                type="button"
                disabled={activating}
                onClick={() => void handleActivate()}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent/90 disabled:opacity-50"
              >
                {activating ? 'Activation…' : 'Activer'}
              </button>
            ) : null}
            <Link
              href={ROUTES.owner.leases}
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
          className="rounded-lg border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger"
        >
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 rounded-md border border-border bg-card p-5 sm:grid-cols-2">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Bien
          </p>
          <Link
            href={ROUTES.owner.property(lease.propertyId)}
            className="mt-1 inline-block font-mono text-sm text-accent hover:underline"
          >
            {lease.propertyId}
          </Link>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Locataire
          </p>
          <p className="mt-1 font-mono text-sm text-foreground">
            {lease.tenantId}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Période
          </p>
          <p className="mt-1 text-sm text-foreground">
            {formatDate(lease.startDate)} → {formatDate(lease.endDate)}
          </p>
        </div>
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-muted">
            Loyer / caution
          </p>
          <p className="mt-1 text-sm text-foreground">
            {formatMoney(lease.monthlyRent, lease.currency)} / mois · caution{' '}
            {formatMoney(lease.deposit, lease.currency)}
          </p>
        </div>
      </div>

      {lease.status === 'ACTIVE' ? (
        <div className="space-y-3">
          <h2 className="text-base font-semibold text-heading">
            Échéancier de loyers
          </h2>
          {schedule.length === 0 ? (
            <p className="text-sm text-muted">Aucune échéance générée.</p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-border">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border bg-card text-muted">
                    <th className="px-3 py-2 font-medium">Échéance</th>
                    <th className="px-3 py-2 font-medium">Montant</th>
                    <th className="px-3 py-2 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {schedule.map((row) => (
                    <tr key={row.id} className="border-b border-border/60">
                      <td className="px-3 py-2">{formatDate(row.dueDate)}</td>
                      <td className="px-3 py-2">
                        {formatMoney(row.amount, row.currency)}
                      </td>
                      <td className="px-3 py-2 text-muted">{row.status}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}
    </section>
  );
}
