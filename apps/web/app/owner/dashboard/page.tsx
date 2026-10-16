'use client';

import {
  OwnerDashboard,
  type OwnerDashboardCounts,
  type OwnerPaymentRow,
  type OwnerVisitRow,
} from '@/app/owner/dashboard/owner-dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import {
  buildPropertyModeSeries,
  type PropertyModeSeries,
} from '@/lib/dashboard/chart-series';
import { listManagedPayments, type PublicPayment } from '@/lib/owner/payments';
import { listManagedProperties } from '@/lib/owner/properties';
import { fetchOwnerStats } from '@/lib/owner/stats';
import { listManagedVisits, type PublicVisitBooking } from '@/lib/visits';
import { useEffect, useState } from 'react';

function formatMoney(amount: string, currency: string): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(new Date(iso));
}

export default function OwnerDashboardPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [counts, setCounts] = useState<OwnerDashboardCounts | null>(null);
  const [payments, setPayments] = useState<OwnerPaymentRow[]>([]);
  const [visits, setVisits] = useState<OwnerVisitRow[]>([]);
  const [chartPayments, setChartPayments] = useState<PublicPayment[]>([]);
  const [modeSeries, setModeSeries] = useState<PropertyModeSeries | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async (): Promise<void> => {
      const [statsResult, paymentsResult, visitsResult, propertiesResult] =
        await Promise.all([
          fetchOwnerStats()
            .then((s) => ({ ok: true as const, s }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          listManagedPayments({ pageSize: 100 })
            .then((r) => ({ ok: true as const, data: r.data }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          listManagedVisits()
            .then((rows) => ({ ok: true as const, rows }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          listManagedProperties()
            .then((rows) => ({ ok: true as const, rows }))
            .catch((err: unknown) => ({ ok: false as const, err })),
        ]);
      if (cancelled) return;

      if (!statsResult.ok) {
        setError(
          statsResult.err instanceof ApiError
            ? statsResult.err.message
            : 'Erreur de chargement des indicateurs',
        );
        setCounts(null);
        return;
      }

      setError(null);
      setCounts({
        activeProperties: statsResult.s.activeProperties,
        draftProperties: statsResult.s.draftProperties,
        activeLeases: statsResult.s.activeLeases,
        pendingPayments: statsResult.s.pendingPayments,
        overdueSchedules: statsResult.s.overdueSchedules,
        pendingVisitRequests: statsResult.s.pendingVisitRequests,
        openMaintenanceTickets: statsResult.s.openMaintenanceTickets,
        pendingApplications: statsResult.s.pendingApplications,
      });

      const titleById = new Map<string, string>();
      if (propertiesResult.ok) {
        for (const p of propertiesResult.rows) {
          titleById.set(p.id, p.title);
        }
        setModeSeries(buildPropertyModeSeries(propertiesResult.rows));
      } else {
        setModeSeries(undefined);
      }

      if (paymentsResult.ok) {
        setPaymentsError(null);
        setPayments(
          paymentsResult.data.slice(0, 5).map((p) => ({
            id: p.id,
            date: formatDate(p.createdAt),
            amount: formatMoney(p.amount, p.currency),
            status: p.status,
            method: p.method,
            propertyTitle: p.propertyId
              ? (titleById.get(p.propertyId) ?? `${p.propertyId.slice(0, 8)}…`)
              : '—',
          })),
        );
        setChartPayments(paymentsResult.data);
      } else {
        setPayments([]);
        setChartPayments([]);
        setPaymentsError(
          paymentsResult.err instanceof ApiError
            ? paymentsResult.err.message
            : 'Impossible de charger les paiements.',
        );
      }

      if (visitsResult.ok) {
        setVisitsError(null);
        setVisits(
          visitsResult.rows
            .filter((v: PublicVisitBooking) => v.status === 'PENDING')
            .slice(0, 5)
            .map((v) => ({
              id: v.id,
              date: formatDate(v.slotStartAt ?? v.createdAt),
              status: v.status,
              propertyId: v.propertyId,
              propertyTitle:
                titleById.get(v.propertyId) ??
                `${v.propertyId.slice(0, 8)}…`,
            })),
        );
      } else {
        setVisits([]);
        setVisitsError(
          visitsResult.err instanceof ApiError
            ? visitsResult.err.message
            : 'Impossible de charger les visites.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (error && !counts) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!counts) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-card" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-32 rounded-xl border border-border bg-card"
            />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="h-80 rounded-xl border border-border bg-card xl:col-span-2" />
          <div className="h-80 rounded-xl border border-border bg-card" />
        </div>
      </div>
    );
  }

  return (
    <OwnerDashboard
      counts={counts}
      payments={payments}
      visits={visits}
      chartPayments={chartPayments}
      modeSeries={modeSeries}
      visitsError={visitsError}
      paymentsError={paymentsError}
    />
  );
}
