'use client';

import {
  DashboardMarketProperties,
  DataTable,
  PropertyModeChart,
  RevenueChart,
  StatCard,
  StatusBadge,
} from '@/components/dashboard';
import type { PropertyModeSeries } from '@/lib/dashboard/chart-series';
import { DASH_CHART_COLORS, DASH_STAT_ICONS } from '@/lib/dash-icons';
import type { PublicPayment } from '@/lib/owner/payments';
import { ROUTES } from '@/lib/routes';

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

const FALLBACK_SPARK = [0, 0, 0, 0, 0, 0, 0];

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
  chartPayments = [],
  modeSeries,
  sparklines,
}: {
  counts: OwnerDashboardCounts;
  payments?: OwnerPaymentRow[];
  visits?: OwnerVisitRow[];
  chartPayments?: PublicPayment[];
  modeSeries?: PropertyModeSeries;
  sparklines?: {
    properties: number[];
    leases: number[];
    payments: number[];
    visits: number[];
  };
}): React.JSX.Element {
  const sparks = sparklines ?? {
    properties: FALLBACK_SPARK,
    leases: FALLBACK_SPARK,
    payments: FALLBACK_SPARK,
    visits: FALLBACK_SPARK,
  };

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Biens actifs"
          value={counts.activeProperties}
          href={ROUTES.owner.properties}
          icon={DASH_STAT_ICONS.buildings}
          sparkline={sparks.properties}
        />
        <StatCard
          label="Baux actifs"
          value={counts.activeLeases}
          href={ROUTES.owner.leases}
          icon={DASH_STAT_ICONS.document}
          sparkline={sparks.leases}
          sparklineColor={DASH_CHART_COLORS.green}
        />
        <StatCard
          label="Paiements en attente"
          value={counts.pendingPayments}
          href={ROUTES.owner.payments}
          icon={DASH_STAT_ICONS.wallet}
          sparkline={sparks.payments}
          sparklineColor={DASH_CHART_COLORS.amber}
        />
        <StatCard
          label="Demandes de visite"
          value={counts.pendingVisitRequests}
          href={ROUTES.owner.visits}
          icon={DASH_STAT_ICONS.calendar}
          sparkline={sparks.visits}
          sparklineColor={DASH_CHART_COLORS.violet}
        />
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
          <div className="xl:col-span-8">
            <RevenueChart payments={chartPayments} />
          </div>
          <div className="xl:col-span-4">
            <PropertyModeChart data={modeSeries} />
          </div>
        </div>
      </div>

      <DashboardMarketProperties role="owner" />

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
