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
  buildDailySparkline,
  buildPropertyModeSeries,
  countByCreatedDay,
  type PropertyModeSeries,
} from '@/lib/dashboard/chart-series';
import { listManagedMaintenance } from '@/lib/owner/maintenance';
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
  const [sparklines, setSparklines] = useState<
    | {
        properties: number[];
        visits: number[];
        payments: number[];
        maintenance: number[];
      }
    | undefined
  >();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async (): Promise<void> => {
      const [statsResult, visitRows, paymentRows, propertyRows, maintenanceRows] =
        await Promise.all([
          fetchAgentStats()
            .then((s) => ({ ok: true as const, s }))
            .catch((err: unknown) => ({ ok: false as const, err })),
          listManagedVisits().catch(() => [] as PublicVisitBooking[]),
          listManagedPayments().catch(() => [] as PublicPayment[]),
          listManagedProperties().catch(() => []),
          listManagedMaintenance().catch(() => []),
        ]);
      if (cancelled) return;

      if (!statsResult.ok) {
        setError(
          statsResult.err instanceof ApiError
            ? statsResult.err.message
            : 'Erreur de chargement des indicateurs',
        );
        setCounts({
          mandatedProperties: 0,
          visitsToday: 0,
          pendingCashValidations: 0,
          openMaintenanceTickets: 0,
        });
      } else {
        setError(null);
        setCounts({
          mandatedProperties: statsResult.s.mandatedProperties,
          visitsToday: statsResult.s.visitsToday,
          pendingCashValidations: statsResult.s.pendingCashValidations,
          openMaintenanceTickets: statsResult.s.openMaintenanceTickets,
        });
      }

      setVisits(
        visitRows
          .filter(
            (v) =>
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
            status: v.status,
          })),
      );

      setPayments(
        paymentRows
          .filter(
            (p) => p.method === 'CASH' && p.status === 'PENDING_VALIDATION',
          )
          .slice(0, 5)
          .map((p) => ({
            id: p.id,
            date: formatDate(p.createdAt),
            amount: formatMoney(p.amount, p.currency),
            status: p.status,
          })),
      );

      setChartPayments(paymentRows);
      setModeSeries(buildPropertyModeSeries(propertyRows));

      const visitByDay = countByCreatedDay(
        visitRows.map((v) => ({
          createdAt: v.slotStartAt ?? v.createdAt,
        })),
      );
      const pendingByDay = countByCreatedDay(
        paymentRows.filter(
          (p) => p.method === 'CASH' && p.status === 'PENDING_VALIDATION',
        ),
      );
      const maintenanceByDay = countByCreatedDay(maintenanceRows);
      const propertyCount = propertyRows.length;
      setSparklines({
        properties: buildDailySparkline(() => propertyCount),
        visits: buildDailySparkline((day) => visitByDay.get(day) ?? 0),
        payments: buildDailySparkline((day) => pendingByDay.get(day) ?? 0),
        maintenance: buildDailySparkline(
          (day) => maintenanceByDay.get(day) ?? 0,
        ),
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
      <AgentDashboard
        counts={counts}
        visits={visits}
        payments={payments}
        chartPayments={chartPayments}
        modeSeries={modeSeries}
        sparklines={sparklines}
      />
    </>
  );
}
