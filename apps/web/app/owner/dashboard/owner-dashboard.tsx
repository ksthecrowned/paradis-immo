'use client';

import {
    DashboardPageHeader,
    DataTable,
    PropertyModeChart,
    RevenueChart,
    SessionsMapCard,
    StatCard,
    StatusBadge,
} from '@/components/dashboard';
import { DASH_CHART_COLORS, DASH_STAT_ICONS } from '@/lib/dash-icons';
import { ROUTES } from '@/lib/routes';
import Link from 'next/link';

export interface OwnerDashboardCounts {
  activeProperties: number;
  activeLeases: number;
  pendingPayments: number;
  pendingVisitRequests: number;
}

export interface OwnerPaymentRow {
  id: string;
  date: string;
  amount: string;
  status: string;
  method: string;
}

export interface OwnerVisitRow {
  id: string;
  date: string;
  status: string;
  propertyId: string;
}

const SPARKLINES = {
  properties: [8, 9, 9, 10, 11, 11, 12],
  leases: [5, 5, 6, 6, 7, 7, 8],
  payments: [1, 2, 1, 3, 2, 4, 3],
  visits: [2, 3, 2, 4, 3, 5, 4],
};

function paymentTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'VALIDATED' || status === 'PAID') return 'success';
  if (status === 'PENDING_VALIDATION' || status === 'PENDING' || status === 'INITIATED')
    return 'warning';
  if (status === 'FAILED') return 'danger';
  return 'neutral';
}

function paymentLabel(status: string): string {
  const map: Record<string, string> = {
    VALIDATED: 'Validé',
    PENDING_VALIDATION: 'En attente',
    INITIATED: 'Initié',
    PENDING: 'En attente',
    FAILED: 'Échoué',
  };
  return map[status] ?? status;
}

function visitTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  if (status === 'CANCELLED') return 'danger';
  return 'neutral';
}

function visitLabel(status: string): string {
  const map: Record<string, string> = {
    CONFIRMED: 'Confirmée',
    PENDING: 'En attente',
    CANCELLED: 'Annulée',
  };
  return map[status] ?? status;
}

export function OwnerDashboard({
  counts,
  payments = [],
  visits = [],
}: {
  counts: OwnerDashboardCounts;
  payments?: OwnerPaymentRow[];
  visits?: OwnerVisitRow[];
}): React.JSX.Element {
  return (
    <section className="space-y-6">
      <DashboardPageHeader
        title="Tableau de bord"
        actions={
          <Link
            href={ROUTES.owner.propertiesAdd}
            className="inline-flex items-center justify-center rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-accent/90"
          >
            Ajouter un bien
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Biens actifs"
          value={counts.activeProperties}
          href={ROUTES.owner.properties}
          icon={DASH_STAT_ICONS.buildings}
          sparkline={SPARKLINES.properties}
        />
        <StatCard
          label="Baux actifs"
          value={counts.activeLeases}
          href={ROUTES.owner.leases}
          icon={DASH_STAT_ICONS.document}
          sparkline={SPARKLINES.leases}
          sparklineColor={DASH_CHART_COLORS.green}
        />
        <StatCard
          label="Paiements en attente"
          value={counts.pendingPayments}
          href={ROUTES.owner.payments}
          icon={DASH_STAT_ICONS.wallet}
          sparkline={SPARKLINES.payments}
          sparklineColor={DASH_CHART_COLORS.amber}
        />
        <StatCard
          label="Demandes de visite"
          value={counts.pendingVisitRequests}
          href={ROUTES.owner.visits}
          icon={DASH_STAT_ICONS.calendar}
          sparkline={SPARKLINES.visits}
          sparklineColor={DASH_CHART_COLORS.violet}
        />
      </div>

      <div className="space-y-2">
        <p className="text-xs text-muted">Aperçu (données démo)</p>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-5">
            <RevenueChart />
          </div>
          <div className="xl:col-span-4">
            <PropertyModeChart />
          </div>
          <div className="xl:col-span-3">
            <SessionsMapCard />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataTable
          title="Dernières demandes de visite"
          viewAllHref={ROUTES.owner.visits}
          columns={[
            {
              key: 'id',
              header: 'Réf.',
              render: (row) => (
                <span className="font-mono text-xs text-muted">
                  {row.id.slice(0, 8)}
                </span>
              ),
            },
            { key: 'date', header: 'Date', render: (row) => row.date },
            {
              key: 'property',
              header: 'Bien',
              render: (row) => (
                <span className="font-mono text-xs">{row.propertyId.slice(0, 8)}…</span>
              ),
            },
            {
              key: 'status',
              header: 'Statut',
              render: (row) => (
                <StatusBadge
                  label={visitLabel(row.status)}
                  tone={visitTone(row.status)}
                />
              ),
            },
          ]}
          rows={visits}
          emptyMessage="Aucune demande de visite"
        />

        <DataTable
          title="Derniers paiements"
          viewAllHref={ROUTES.owner.payments}
          columns={[
            {
              key: 'id',
              header: 'Réf.',
              render: (row) => (
                <span className="font-mono text-xs text-muted">
                  {row.id.slice(0, 8)}
                </span>
              ),
            },
            { key: 'date', header: 'Date', render: (row) => row.date },
            {
              key: 'amount',
              header: 'Montant',
              render: (row) => (
                <span className="font-medium">{row.amount}</span>
              ),
            },
            {
              key: 'status',
              header: 'Statut',
              render: (row) => (
                <StatusBadge
                  label={paymentLabel(row.status)}
                  tone={paymentTone(row.status)}
                />
              ),
            },
          ]}
          rows={payments}
          emptyMessage="Aucun paiement récent"
        />
      </div>
    </section>
  );
}
