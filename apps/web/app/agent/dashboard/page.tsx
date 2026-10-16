'use client';

import {
  AgentDashboard,
  type AgentDashboardCounts,
  type AgentPaymentRow,
  type AgentVisitRow,
} from '@/app/agent/dashboard/agent-dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError } from '@/lib/api';
import { fetchAgentStats } from '@/lib/agent/stats';
import {
  buildPropertyModeSeries,
  type PropertyModeSeries,
} from '@/lib/dashboard/chart-series';
import { listManagedPayments, type PublicPayment } from '@/lib/owner/payments';
import { listManagedProperties } from '@/lib/owner/properties';
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

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Africa/Brazzaville',
  }).format(new Date(iso));
}

function isTodayInBrazzaville(iso: string): boolean {
  const dayFmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Brazzaville',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return dayFmt.format(new Date(iso)) === dayFmt.format(new Date());
}

export default function AgentDashboardPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [counts, setCounts] = useState<AgentDashboardCounts | null>(null);
  const [visits, setVisits] = useState<AgentVisitRow[]>([]);
  const [payments, setPayments] = useState<AgentPaymentRow[]>([]);
  const [chartPayments, setChartPayments] = useState<PublicPayment[]>([]);
  const [modeSeries, setModeSeries] = useState<PropertyModeSeries | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [visitsError, setVisitsError] = useState<string | null>(null);
  const [paymentsError, setPaymentsError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async (): Promise<void> => {
      const [statsResult, visitsResult, paymentsResult, propertiesResult] =
        await Promise.all([
          fetchAgentStats()
            .then((s) => ({ ok: true as const, s }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          listManagedVisits()
            .then((rows) => ({ ok: true as const, rows }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          listManagedPayments({ pageSize: 100 })
            .then((r) => ({ ok: true as const, data: r.data }))
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
        mandatedProperties: statsResult.s.mandatedProperties,
        visitsToday: statsResult.s.visitsToday,
        upcomingVisits: statsResult.s.upcomingVisits,
        pendingCashValidations: statsResult.s.pendingCashValidations,
        openMaintenanceTickets: statsResult.s.openMaintenanceTickets,
        activeLeases: statsResult.s.activeLeases,
        overdueSchedules: statsResult.s.overdueSchedules,
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

      if (visitsResult.ok) {
        setVisitsError(null);
        setVisits(
          visitsResult.rows
            .filter(
              (v: PublicVisitBooking) =>
                v.slotStartAt != null &&
                isTodayInBrazzaville(v.slotStartAt) &&
                (v.status === 'PENDING' || v.status === 'CONFIRMED'),
            )
            .sort((a, b) =>
              (a.slotStartAt ?? '').localeCompare(b.slotStartAt ?? ''),
            )
            .slice(0, 5)
            .map((v) => ({
              id: v.id,
              time: formatTime(v.slotStartAt!),
              propertyId: v.propertyId,
              propertyTitle:
                titleById.get(v.propertyId) ??
                `${v.propertyId.slice(0, 8)}…`,
              status: v.status,
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

      if (paymentsResult.ok) {
        setPaymentsError(null);
        const pendingCash = paymentsResult.data.filter(
          (p) => p.method === 'CASH' && p.status === 'PENDING_VALIDATION',
        );
        setPayments(
          pendingCash.slice(0, 5).map((p) => ({
            id: p.id,
            date: formatDate(p.createdAt),
            amount: formatMoney(p.amount, p.currency),
            propertyTitle: p.propertyId
              ? (titleById.get(p.propertyId) ?? `${p.propertyId.slice(0, 8)}…`)
              : '—',
            status: p.status,
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
    <AgentDashboard
      counts={counts}
      visits={visits}
      payments={payments}
      chartPayments={chartPayments}
      modeSeries={modeSeries}
      visitsError={visitsError}
      paymentsError={paymentsError}
    />
  );
}
