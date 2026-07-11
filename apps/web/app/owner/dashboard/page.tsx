'use client';

import { useEffect, useState } from 'react';
import { apiFetch, ApiError } from '@/lib/api';
import { useRequireSession } from '@/hooks/use-require-session';
import {
  OwnerDashboard,
  type OwnerDashboardCounts,
  type OwnerPaymentRow,
  type OwnerVisitRow,
} from '@/app/owner/dashboard/owner-dashboard';

interface PublicPayment {
  id: string;
  status: string;
  amount: string;
  currency: string;
  method: string;
  createdAt: string;
}

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
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const [paymentRows, visitRows] = await Promise.all([
          apiFetch<PublicPayment[]>('/payments/my').catch(() => [] as PublicPayment[]),
          apiFetch<PublicVisitBooking[]>('/visits/managed').catch(() => [] as PublicVisitBooking[]),
        ]);
        if (cancelled) return;
        const nextCounts: OwnerDashboardCounts = {
          properties: null,
          activeLeases: null,
          pendingPayments: paymentRows.filter(
            (p) =>
              p.status === 'PENDING' ||
              p.status === 'PENDING_VALIDATION' ||
              p.status === 'FAILED',
          ).length,
          visitRequests: visitRows.filter((v) => v.status === 'PENDING').length,
        };
        setCounts(nextCounts);
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
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Erreur de chargement');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready]);

  if (error) {
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
    <OwnerDashboard counts={counts} payments={payments} visits={visits} />
  );
}
