'use client';

/**
 * Page tableau de bord propriétaire.
 *
 * Côté client uniquement : on lit les tokens depuis localStorage
 * et on appelle les endpoints "me" via `apiFetch`. Les compteurs
 * indisponibles restent à `null` et le composant `OwnerDashboard`
 * affiche alors un placeholder "Bientôt disponible".
 */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch, ApiError } from '@/lib/api';
import { getTokens } from '@/lib/auth';
import {
  OwnerDashboard,
  type OwnerDashboardCounts,
} from '@/app/owner/dashboard/owner-dashboard';

interface PublicPayment {
  id: string;
  status: string;
  // autres champs ignorés
}
interface PublicVisitBooking {
  id: string;
  status: string;
}

export default function OwnerDashboardPage(): React.JSX.Element {
  const router = useRouter();
  const [counts, setCounts] = useState<OwnerDashboardCounts | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getTokens().accessToken) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const [payments, visits] = await Promise.all([
          apiFetch<PublicPayment[]>('/payments/my').catch(() => [] as PublicPayment[]),
          apiFetch<PublicVisitBooking[]>('/visits/managed').catch(() => [] as PublicVisitBooking[]),
        ]);
        if (cancelled) return;
        const nextCounts: OwnerDashboardCounts = {
          properties: null, // /properties/mine pas encore exposé
          activeLeases: null, // pas d'endpoint propriétaire dédié
          pendingPayments: payments.filter(
            (p) => p.status === 'PENDING' || p.status === 'FAILED',
          ).length,
          visitRequests: visits.filter((v) => v.status === 'PENDING').length,
        };
        setCounts(nextCounts);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof ApiError ? err.message : 'Erreur de chargement');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="rounded-lg border border-dash-danger/40 bg-dash-danger/10 p-4 text-sm text-dash-danger">
        {error}
      </div>
    );
  }
  if (!counts) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-64 rounded bg-dash-card" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="h-28 rounded-xl border border-dash-border bg-dash-card"
            />
          ))}
        </div>
      </div>
    );
  }
  return <OwnerDashboard counts={counts} />;
}
