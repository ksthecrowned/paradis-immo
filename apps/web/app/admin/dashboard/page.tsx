'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AdminDashboard } from '@/app/admin/dashboard/admin-dashboard';
import { ApiError } from '@/lib/api';
import { getAdminStats, type AdminStats } from '@/lib/admin/stats';
import { getTokens } from '@/lib/auth';

export default function AdminDashboardPage(): React.JSX.Element {
  const router = useRouter();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getTokens().accessToken) {
      router.replace('/login');
      return;
    }
    let cancelled = false;
    (async (): Promise<void> => {
      try {
        const data = await getAdminStats();
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : 'Erreur de chargement');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  if (error) {
    return (
      <div className="rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
        {error}
      </div>
    );
  }

  if (!stats) {
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
      </div>
    );
  }

  return <AdminDashboard stats={stats} />;
}
