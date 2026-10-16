'use client';

import { useEffect, useState } from 'react';
import { AdminDashboard } from '@/app/admin/dashboard/admin-dashboard';
import { ApiError } from '@/lib/api';
import {
  listAdminReports,
  type AdminReportRow,
} from '@/lib/admin/reports';
import {
  getAdminStats,
  modeSeriesFromAdminStats,
  type AdminStats,
} from '@/lib/admin/stats';
import { listUsers, type AdminUser } from '@/lib/admin/users';
import type {
  ChartRangeKey,
  PropertyModeSeries,
} from '@/lib/dashboard/chart-series';
import { useRequireSession } from '@/hooks/use-require-session';

export default function AdminDashboardPage(): React.JSX.Element {
  const { ready } = useRequireSession();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [recentUsers, setRecentUsers] = useState<AdminUser[]>([]);
  const [openReports, setOpenReports] = useState<AdminReportRow[]>([]);
  const [modeSeries, setModeSeries] = useState<PropertyModeSeries | undefined>();
  const [chartRange, setChartRange] = useState<ChartRangeKey>('1y');
  const [error, setError] = useState<string | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [reportsError, setReportsError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async (): Promise<void> => {
      const [statsResult, usersResult, reportsResult] = await Promise.all([
        getAdminStats(chartRange)
          .then((s) => ({ ok: true as const, s }))
          .catch((err: unknown) => ({ ok: false as const, err })),
        listUsers({ page: 1, limit: 8 })
          .then((r) => ({ ok: true as const, data: r.data }))
          .catch((err: unknown) => ({ ok: false as const, err })),
        listAdminReports({ status: 'OPEN', page: 1, pageSize: 8 })
          .then((r) => ({ ok: true as const, data: r.data }))
          .catch((err: unknown) => ({ ok: false as const, err })),
      ]);

      if (cancelled) return;

      if (!statsResult.ok) {
        setError(
          statsResult.err instanceof ApiError
            ? statsResult.err.message
            : 'Erreur de chargement des indicateurs',
        );
        return;
      }

      setError(null);
      setModeSeries(modeSeriesFromAdminStats(statsResult.s.charts));
      setStats(statsResult.s);

      if (usersResult.ok) {
        setRecentUsers(usersResult.data);
        setUsersError(null);
      } else {
        setRecentUsers([]);
        setUsersError(
          usersResult.err instanceof ApiError
            ? usersResult.err.message
            : 'Impossible de charger les utilisateurs.',
        );
      }

      if (reportsResult.ok) {
        setOpenReports(reportsResult.data);
        setReportsError(null);
      } else {
        setOpenReports([]);
        setReportsError(
          reportsResult.err instanceof ApiError
            ? reportsResult.err.message
            : 'Impossible de charger les signalements.',
        );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, chartRange]);

  if (error && !stats) {
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

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm text-danger">
          {error}
        </div>
      ) : null}
      <AdminDashboard
        stats={stats}
        recentUsers={recentUsers}
        openReports={openReports}
        modeSeries={modeSeries}
        chartRange={chartRange}
        onChartRangeChange={setChartRange}
        usersError={usersError}
        reportsError={reportsError}
      />
    </>
  );
}
