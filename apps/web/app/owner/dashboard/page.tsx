'use client';

import {
  OwnerDashboard,
  type OwnerDashboardCounts,
  type OwnerPaymentRow,
  type OwnerVisitRow,
} from '@/app/owner/dashboard/owner-dashboard';
import { useRequireSession } from '@/hooks/use-require-session';
import { ApiError, apiFetch } from '@/lib/api';
import {
  buildDailySparkline,
  buildPropertyModeSeries,
  countByCreatedDay,
  type PropertyModeSeries,
} from '@/lib/dashboard/chart-series';
import { listManagedLeases } from '@/lib/owner/leases';
import { listManagedPayments, type PublicPayment } from '@/lib/owner/payments';
import { listManagedProperties } from '@/lib/owner/properties';
import { fetchOwnerStats } from '@/lib/owner/stats';
import { useEffect, useState } from 'react';

interface PublicVisitBooking {
  id: string;
  status: string;
  propertyId: string;
  createdAt: string;
}

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
  const [sparklines, setSparklines] = useState<
    | {
        properties: number[];
        leases: number[];
        payments: number[];
        visits: number[];
      }
    | undefined
  >();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async (): Promise<void> => {
      const [statsResult, paymentRows, visitRows, propertyRows, leaseRows] =
        await Promise.all([
          fetchOwnerStats()
            .then((s) => ({ ok: true as const, s }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          listManagedPayments().catch(() => [] as PublicPayment[]),
          apiFetch<PublicVisitBooking[]>('/visits/managed').catch(
            () => [] as PublicVisitBooking[],
          ),
          listManagedProperties().catch(() => []),
          listManagedLeases().catch(() => []),
        ]);
      if (cancelled) return;

      if (!statsResult.ok) {
        setError(
          statsResult.err instanceof ApiError
            ? statsResult.err.message
            : 'Erreur de chargement des indicateurs',
        );
        setCounts({
          activeProperties: 0,
          activeLeases: 0,
          pendingPayments: 0,
          pendingVisitRequests: 0,
        });
      } else {
        setError(null);
        setCounts({
          activeProperties: statsResult.s.activeProperties,
          activeLeases: statsResult.s.activeLeases,
          pendingPayments: statsResult.s.pendingPayments,
          pendingVisitRequests: statsResult.s.pendingVisitRequests,
        });
      }

      setPayments(
        paymentRows.slice(0, 5).map((p) => ({
          id: p.id,
          date: formatDate(p.createdAt),
          amount: formatMoney(p.amount, p.currency),
          status: p.status,
          method: p.method,
        })),
      );
      setVisits(
        visitRows.slice(0, 5).map((v) => ({
          id: v.id,
          date: formatDate(v.createdAt),
          status: v.status,
          propertyId: v.propertyId,
        })),
      );
      setChartPayments(paymentRows);
      setModeSeries(buildPropertyModeSeries(propertyRows));

      const paymentByDay = countByCreatedDay(
        paymentRows.filter((p) => p.status === 'PENDING_VALIDATION'),
      );
      const visitByDay = countByCreatedDay(visitRows);
      const leaseCount = leaseRows.filter((l) => l.status === 'ACTIVE').length;
      const propertyCount = propertyRows.filter(
        (p) => p.status === 'ACTIVE',
      ).length;
      setSparklines({
        properties: buildDailySparkline(() => propertyCount),
        leases: buildDailySparkline(() => leaseCount),
        payments: buildDailySparkline((day) => paymentByDay.get(day) ?? 0),
        visits: buildDailySparkline((day) => visitByDay.get(day) ?? 0),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

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
    <>
      {error ? (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <OwnerDashboard
        counts={counts}
        payments={payments}
        visits={visits}
        chartPayments={chartPayments}
        modeSeries={modeSeries}
        sparklines={sparklines}
      />
    </>
  );
}
