import { ApiError, apiFetch } from '@/lib/api';
import type { ChartRangeKey } from '@/lib/dashboard/chart-series';

export type AdminStatsRange = ChartRangeKey;

export interface AdminActivitySeries {
  categories: string[];
  users: number[];
  properties: number[];
  paymentVolume: number[];
  paymentCounts: number[];
}

export interface AdminStatsCharts {
  range: AdminStatsRange;
  propertiesByMode: {
    rentShort: number;
    rentLong: number;
    sale: number;
  };
  activity: AdminActivitySeries;
}

export interface AdminStats {
  totalUsers: number;
  suspendedUsers: number;
  totalProperties: number;
  activeProperties: number;
  activeLeases: number;
  totalOrganizations: number;
  overdueSchedules: number;
  pendingRentSchedules: number;
  openReports: number;
  pendingOrgRequests: number;
  pendingKyc: number;
  pendingPaymentValidations: number;
  openDisputes: number;
  failedPayouts: number;
  pendingVisits: number;
  charts: AdminStatsCharts;
}

function isAdminStatsCharts(value: unknown): value is AdminStatsCharts {
  if (!value || typeof value !== 'object') return false;
  const charts = value as AdminStatsCharts;
  const activity = charts.activity;
  const mode = charts.propertiesByMode;
  return (
    !!activity &&
    Array.isArray(activity.categories) &&
    Array.isArray(activity.users) &&
    Array.isArray(activity.properties) &&
    Array.isArray(activity.paymentVolume) &&
    Array.isArray(activity.paymentCounts) &&
    !!mode &&
    typeof mode.rentShort === 'number' &&
    typeof mode.rentLong === 'number' &&
    typeof mode.sale === 'number'
  );
}

export async function getAdminStats(
  range: AdminStatsRange = '1y',
): Promise<AdminStats> {
  const params = new URLSearchParams({ range });
  const stats = await apiFetch<AdminStats>(`/admin/stats?${params}`);
  if (!isAdminStatsCharts(stats?.charts)) {
    throw new ApiError(
      'Réponse statistiques incomplète : redémarrez l’API pour charger les séries graphiques.',
      502,
      stats,
    );
  }
  return stats;
}

export function modeSeriesFromAdminStats(
  charts: AdminStatsCharts,
): {
  series: [number, number, number];
  rows: Array<{ name: string; count: number; percent: string }>;
} {
  const rentShort = charts.propertiesByMode.rentShort;
  const rentLong = charts.propertiesByMode.rentLong;
  const sale = charts.propertiesByMode.sale;
  const total = rentShort + rentLong + sale;
  const pct = (n: number): string =>
    total === 0 ? '0%' : `${Math.round((n / total) * 100)}%`;
  return {
    series: [rentShort, rentLong, sale],
    rows: [
      { name: 'Location courte', count: rentShort, percent: pct(rentShort) },
      { name: 'Location longue', count: rentLong, percent: pct(rentLong) },
      { name: 'Vente', count: sale, percent: pct(sale) },
    ],
  };
}
