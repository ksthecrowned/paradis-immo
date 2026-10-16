'use client';

import {
  adaptSummaryColumns,
  AdminActivityChart,
  ListDataTable,
  PropertyModeChart,
  StatCard,
  StatusBadge,
  UserIdentity,
} from '@/components/dashboard';
import {
  REPORT_REASON_LABELS,
  REPORT_STATUS_LABELS,
  reportStatusTone,
  type AdminReportRow,
} from '@/lib/admin/reports';
import type { AdminStats } from '@/lib/admin/stats';
import type { AdminUser } from '@/lib/admin/users';
import type {
  ChartRangeKey,
  PropertyModeSeries,
} from '@/lib/dashboard/chart-series';
import { DASH_CHART_COLORS, DASH_STAT_ICONS } from '@/lib/dash-icons';
import { ROUTES } from '@/lib/routes';
import { useRouter } from 'next/navigation';

function userTone(
  status: AdminUser['status'],
): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'ACTIVE') return 'success';
  if (status === 'SUSPENDED') return 'danger';
  if (status === 'DELETED') return 'neutral';
  return 'neutral';
}

function userLabel(status: AdminUser['status']): string {
  const map: Record<AdminUser['status'], string> = {
    ACTIVE: 'Actif',
    SUSPENDED: 'Suspendu',
    DELETED: 'Supprimé',
  };
  return map[status] ?? status;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export interface AdminDashboardProps {
  stats: AdminStats;
  recentUsers: AdminUser[];
  openReports: AdminReportRow[];
  modeSeries?: PropertyModeSeries;
  chartRange: ChartRangeKey;
  onChartRangeChange: (range: ChartRangeKey) => void;
  usersError?: string | null;
  reportsError?: string | null;
}

export function AdminDashboard({
  stats,
  recentUsers,
  openReports,
  modeSeries,
  chartRange,
  onChartRangeChange,
  usersError,
  reportsError,
}: AdminDashboardProps): React.JSX.Element {
  const router = useRouter();

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Vue plateforme</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Utilisateurs"
            value={formatCount(stats.totalUsers)}
            href={ROUTES.admin.users}
            icon={DASH_STAT_ICONS.users}
            iconColor={DASH_CHART_COLORS.purple}
          />
          <StatCard
            label="Biens actifs"
            value={formatCount(stats.activeProperties)}
            href={ROUTES.admin.moderation}
            icon={DASH_STAT_ICONS.buildings}
            iconColor={DASH_CHART_COLORS.green}
          />
          <StatCard
            label="Baux actifs"
            value={formatCount(stats.activeLeases)}
            icon={DASH_STAT_ICONS.document}
            iconColor={DASH_CHART_COLORS.blue}
          />
          <StatCard
            label="Organisations"
            value={formatCount(stats.totalOrganizations)}
            href={ROUTES.admin.organizations}
            icon={DASH_STAT_ICONS.handshake}
            iconColor={DASH_CHART_COLORS.teal}
          />
          <StatCard
            label="Biens (total)"
            value={formatCount(stats.totalProperties)}
            href={ROUTES.admin.moderation}
            icon={DASH_STAT_ICONS.chart}
            iconColor={DASH_CHART_COLORS.slate}
          />
          <StatCard
            label="Comptes suspendus"
            value={formatCount(stats.suspendedUsers)}
            href={ROUTES.admin.users}
            icon={DASH_STAT_ICONS.userBlock}
            iconColor={DASH_CHART_COLORS.rose}
          />
          <StatCard
            label="Échéances en attente"
            value={formatCount(stats.pendingRentSchedules)}
            icon={DASH_STAT_ICONS.clock}
            iconColor={DASH_CHART_COLORS.violet}
          />
          <StatCard
            label="Visites en attente"
            value={formatCount(stats.pendingVisits)}
            icon={DASH_STAT_ICONS.calendar}
            iconColor={DASH_CHART_COLORS.blue}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">À traiter</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Dossiers d’ouverture"
            value={formatCount(stats.pendingOrgRequests)}
            href={ROUTES.admin.onboarding}
            icon={DASH_STAT_ICONS.bag}
            iconColor={DASH_CHART_COLORS.amber}
          />
          <StatCard
            label="Signalements ouverts"
            value={formatCount(stats.openReports)}
            href={ROUTES.admin.reports}
            icon={DASH_STAT_ICONS.flag}
            iconColor={DASH_CHART_COLORS.rose}
          />
          <StatCard
            label="Échéances en retard"
            value={formatCount(stats.overdueSchedules)}
            icon={DASH_STAT_ICONS.bills}
            iconColor={DASH_CHART_COLORS.amber}
          />
          <StatCard
            label="KYC en attente"
            value={formatCount(stats.pendingKyc)}
            href={ROUTES.admin.users}
            icon={DASH_STAT_ICONS.userId}
            iconColor={DASH_CHART_COLORS.violet}
          />
          <StatCard
            label="Paiements à valider"
            value={formatCount(stats.pendingPaymentValidations)}
            icon={DASH_STAT_ICONS.wallet}
            iconColor={DASH_CHART_COLORS.teal}
          />
          <StatCard
            label="Litiges ouverts"
            value={formatCount(stats.openDisputes)}
            icon={DASH_STAT_ICONS.danger}
            iconColor={DASH_CHART_COLORS.rose}
          />
          <StatCard
            label="Reversements échoués"
            value={formatCount(stats.failedPayouts)}
            icon={DASH_STAT_ICONS.card}
            iconColor={DASH_CHART_COLORS.amber}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <AdminActivityChart
            data={stats.charts.activity}
            range={chartRange}
            onRangeChange={onChartRangeChange}
          />
        </div>
        <div className="xl:col-span-4">
          <PropertyModeChart
            data={modeSeries}
            emptyMessage="Aucun bien à analyser"
          />
        </div>
      </div>

      <ListDataTable
        title="Signalements ouverts"
        subtitle="À traiter en priorité"
        viewAllHref={ROUTES.admin.reports}
        compact
        columns={adaptSummaryColumns<AdminReportRow>([
          {
            key: 'property',
            header: 'Bien',
            render: (row) => (
              <div className="min-w-0">
                <p className="truncate font-medium">{row.propertyTitle}</p>
                <p className="truncate text-xs text-muted">
                  {REPORT_REASON_LABELS[row.reason] ?? row.reason}
                </p>
              </div>
            ),
          },
          {
            key: 'date',
            header: 'Date',
            render: (row) => formatDate(row.createdAt),
          },
          {
            key: 'status',
            header: 'Statut',
            render: (row) => (
              <StatusBadge
                label={REPORT_STATUS_LABELS[row.status]}
                tone={reportStatusTone(row.status)}
              />
            ),
          },
        ])}
        data={openReports}
        emptyMessage={
          reportsError ? reportsError : 'Aucun signalement ouvert'
        }
        onRowClick={(row) => router.push(ROUTES.admin.report(row.id))}
      />

      <ListDataTable
        title="Nouveaux comptes"
        subtitle="Derniers inscrits"
        viewAllHref={ROUTES.admin.users}
        compact
        columns={adaptSummaryColumns<AdminUser>([
          {
            key: 'name',
            header: 'Utilisateur',
            render: (row) => (
              <UserIdentity
                name={row.name ?? row.phone}
                avatarUrl={row.avatarUrl}
                fallbackName="Utilisateur"
              />
            ),
          },
          {
            key: 'date',
            header: 'Inscription',
            render: (row) => formatDate(row.createdAt),
          },
          {
            key: 'country',
            header: 'Pays',
            render: (row) => row.countryName || '—',
          },
          {
            key: 'status',
            header: 'Statut',
            render: (row) => (
              <StatusBadge
                label={userLabel(row.status)}
                tone={userTone(row.status)}
              />
            ),
          },
        ])}
        data={recentUsers}
        emptyMessage={usersError ? usersError : 'Aucun utilisateur récent'}
        onRowClick={(row) => router.push(ROUTES.admin.user(row.id))}
      />
    </section>
  );
}
