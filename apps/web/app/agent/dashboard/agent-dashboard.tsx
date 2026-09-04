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
import Link from 'next/link';

export interface AgentDashboardCounts {
  mandatedProperties: number;
  visitsToday: number;
  pendingCashValidations: number;
  openMaintenanceTickets: number;
}

export interface AgentVisitRow {
  id: string;
  time: string;
  propertyId: string;
  status: string;
}

export interface AgentPaymentRow {
  id: string;
  date: string;
  amount: string;
  status: string;
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

export function AgentDashboard({
  counts,
  visits = [],
  payments = [],
  chartPayments = [],
  modeSeries,
  sparklines,
}: {
  counts: AgentDashboardCounts;
  visits?: AgentVisitRow[];
  payments?: AgentPaymentRow[];
  chartPayments?: PublicPayment[];
  modeSeries?: PropertyModeSeries;
  sparklines?: {
    properties: number[];
    visits: number[];
    payments: number[];
    maintenance: number[];
  };
}): React.JSX.Element {
  const sparks = sparklines ?? {
    properties: [counts.mandatedProperties],
    visits: [counts.visitsToday],
    payments: [counts.pendingCashValidations],
    maintenance: [counts.openMaintenanceTickets],
  };

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Biens mandatés"
          value={counts.mandatedProperties}
          href={ROUTES.agent.portfolio}
          icon={DASH_STAT_ICONS.buildings}
          sparkline={sparks.properties}
        />
        <StatCard
          label="Visites aujourd'hui"
          value={counts.visitsToday}
          href={ROUTES.agent.visits}
          icon={DASH_STAT_ICONS.calendar}
          sparkline={sparks.visits}
          sparklineColor={DASH_CHART_COLORS.green}
        />
        <StatCard
          label="Paiements à valider"
          value={counts.pendingCashValidations}
          href={ROUTES.agent.paymentsValidation}
          icon={DASH_STAT_ICONS.wallet}
          sparkline={sparks.payments}
          sparklineColor={DASH_CHART_COLORS.amber}
        />
        <StatCard
          label="Tickets maintenance"
          value={counts.openMaintenanceTickets}
          href={ROUTES.agent.maintenance}
          icon={DASH_STAT_ICONS.wrench}
          sparkline={sparks.maintenance}
          sparklineColor={DASH_CHART_COLORS.violet}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <RevenueChart payments={chartPayments} />
        </div>
        <div className="xl:col-span-4">
          <PropertyModeChart data={modeSeries} />
        </div>
      </div>

      <DashboardMarketProperties role="agent" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataTable
          title="Visites du jour"
          viewAllHref={ROUTES.agent.visits}
          columns={[
            { key: 'time', header: 'Heure', render: (row) => row.time },
            {
              key: 'property',
              header: 'Bien',
              render: (row) => (
                <span className="font-mono text-xs">
                  {row.propertyId.slice(0, 8)}…
                </span>
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
          emptyMessage="Aucune visite aujourd'hui"
        />

        <DataTable
          title="Paiements espèces"
          viewAllHref={ROUTES.agent.paymentsValidation}
          columns={[
            {
              key: 'id',
              header: 'Réf.',
              render: (row) => (
                <Link
                  href={ROUTES.agent.payment(row.id)}
                  className="font-mono text-xs text-accent hover:underline"
                >
                  {row.id.slice(0, 8)}
                </Link>
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
          emptyMessage="Aucun paiement à valider"
        />
      </div>
    </section>
  );
}
