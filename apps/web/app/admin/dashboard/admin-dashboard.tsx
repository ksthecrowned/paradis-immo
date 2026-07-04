'use client';

import {
  DashboardPageHeader,
  DataTable,
  PropertyModeChart,
  RevenueChart,
  StatCard,
  StatusBadge,
} from '@/components/dashboard';
import { DASH_CHART_COLORS, DASH_STAT_ICONS } from '@/lib/dash-icons';
import type { AdminStats } from '@/lib/admin/stats';
import { ROUTES } from '@/lib/routes';

const DEMO_USERS = [
  { id: 'u1', name: 'Marie Koumba', date: '27 juin 2026', status: 'verified', username: '@marie.k' },
  { id: 'u2', name: 'Jean Mabiala', date: '26 juin 2026', status: 'pending', username: '@jean.m' },
  { id: 'u3', name: 'Amina Nzouba', date: '25 juin 2026', status: 'verified', username: '@amina.n' },
  { id: 'u4', name: 'Paul Okemba', date: '24 juin 2026', status: 'blocked', username: '@paul.o' },
];

const DEMO_TX = [
  { id: 't1', date: '27 juin', amount: '450 000 XAF', type: 'credit', label: 'Loyer juin' },
  { id: 't2', date: '26 juin', amount: '25 000 XAF', type: 'debit', label: 'Commission' },
  { id: 't3', date: '26 juin', amount: '180 000 XAF', type: 'credit', label: 'Location courte' },
  { id: 't4', date: '25 juin', amount: '12 000 XAF', type: 'debit', label: 'Frais visite' },
];

function userTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'verified') return 'success';
  if (status === 'pending') return 'warning';
  if (status === 'blocked') return 'danger';
  return 'neutral';
}

function userLabel(status: string): string {
  const map: Record<string, string> = {
    verified: 'Vérifié',
    pending: 'En attente',
    blocked: 'Bloqué',
  };
  return map[status] ?? status;
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('fr-FR').format(value);
}

export interface AdminDashboardProps {
  stats: AdminStats;
}

export function AdminDashboard({ stats }: AdminDashboardProps): React.JSX.Element {
  return (
    <section className="space-y-6">
      <DashboardPageHeader title="Tableau de bord" />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Utilisateurs"
          value={formatCount(stats.totalUsers)}
          href={ROUTES.admin.users}
          icon={DASH_STAT_ICONS.users}
        />
        <StatCard
          label="Biens"
          value={formatCount(stats.totalProperties)}
          href={ROUTES.admin.moderation}
          icon={DASH_STAT_ICONS.buildings}
          sparklineColor={DASH_CHART_COLORS.green}
        />
        <StatCard
          label="Baux actifs"
          value={formatCount(stats.activeLeases)}
          icon={DASH_STAT_ICONS.document}
          sparklineColor={DASH_CHART_COLORS.violet}
        />
        <StatCard
          label="Échéances en retard"
          value={formatCount(stats.overdueSchedules)}
          href={ROUTES.admin.moderation}
          icon={DASH_STAT_ICONS.shield}
          sparklineColor={DASH_CHART_COLORS.amber}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted">Organisations</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatCount(stats.totalOrganizations)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted">Échéances en attente</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatCount(stats.pendingRentSchedules)}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card px-5 py-4">
          <p className="text-xs text-muted">Biens + baux</p>
          <p className="mt-1 text-2xl font-semibold text-foreground">
            {formatCount(stats.totalProperties + stats.activeLeases)}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-6">
          <RevenueChart />
        </div>
        <div className="xl:col-span-6">
          <PropertyModeChart />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataTable
          title="Nouveaux comptes"
          subtitle="Données de démonstration"
          viewAllHref={ROUTES.admin.users}
          columns={[
            {
              key: 'name',
              header: 'Utilisateur',
              render: (row) => (
                <div className="flex items-center gap-2">
                  <span className="flex size-8 items-center justify-center rounded-full bg-accent/20 text-xs font-semibold text-accent">
                    {row.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)}
                  </span>
                  <div>
                    <p className="font-medium">{row.name}</p>
                    <p className="text-xs text-muted">{row.username}</p>
                  </div>
                </div>
              ),
            },
            { key: 'date', header: 'Date', render: (row) => row.date },
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
          ]}
          rows={DEMO_USERS}
        />

        <DataTable
          title="Transactions récentes"
          subtitle="Données de démonstration"
          columns={[
            { key: 'date', header: 'Date', render: (row) => row.date },
            {
              key: 'amount',
              header: 'Montant',
              render: (row) => (
                <span
                  className={
                    row.type === 'credit'
                      ? 'font-medium text-success'
                      : 'font-medium text-danger'
                  }
                >
                  {row.type === 'credit' ? '+' : '−'}
                  {row.amount}
                </span>
              ),
            },
            { key: 'label', header: 'Description', render: (row) => row.label },
          ]}
          rows={DEMO_TX}
        />
      </div>
    </section>
  );
}
