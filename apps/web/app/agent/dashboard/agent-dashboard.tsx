'use client';

import {
  adaptSummaryColumns,
  DashboardMarketProperties,
  ListDataTable,
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
import { useRouter } from 'next/navigation';

export interface AgentDashboardCounts {
  mandatedProperties: number;
  visitsToday: number;
  upcomingVisits: number;
  pendingCashValidations: number;
  openMaintenanceTickets: number;
  activeLeases: number;
  overdueSchedules: number;
  pendingApplications: number;
}

export interface AgentVisitRow {
  id: string;
  time: string;
  propertyId: string;
  propertyTitle: string;
  status: string;
}

export interface AgentPaymentRow {
  id: string;
  date: string;
  amount: string;
  propertyTitle: string;
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
  visitsError,
  paymentsError,
}: {
  counts: AgentDashboardCounts;
  visits?: AgentVisitRow[];
  payments?: AgentPaymentRow[];
  chartPayments?: PublicPayment[];
  modeSeries?: PropertyModeSeries;
  visitsError?: string | null;
  paymentsError?: string | null;
}): React.JSX.Element {
  const router = useRouter();

  return (
    <section className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">Portefeuille</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Biens actifs"
            value={counts.mandatedProperties}
            href={ROUTES.agent.portfolio}
            icon={DASH_STAT_ICONS.buildings}
            iconColor={DASH_CHART_COLORS.green}
          />
          <StatCard
            label="Baux actifs"
            value={counts.activeLeases}
            href={ROUTES.agent.leases}
            icon={DASH_STAT_ICONS.document}
            iconColor={DASH_CHART_COLORS.blue}
          />
          <StatCard
            label="Échéances en retard"
            value={counts.overdueSchedules}
            href={ROUTES.agent.arrears}
            icon={DASH_STAT_ICONS.bills}
            iconColor={DASH_CHART_COLORS.rose}
          />
          <StatCard
            label="Candidatures"
            value={counts.pendingApplications}
            href={ROUTES.agent.applications}
            icon={DASH_STAT_ICONS.bag}
            iconColor={DASH_CHART_COLORS.teal}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">À traiter aujourd’hui</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Visites aujourd’hui"
            value={counts.visitsToday}
            href={ROUTES.agent.visits}
            icon={DASH_STAT_ICONS.calendar}
            iconColor={DASH_CHART_COLORS.amber}
          />
          <StatCard
            label="Visites à venir (7 j)"
            value={counts.upcomingVisits}
            href={ROUTES.agent.visits}
            icon={DASH_STAT_ICONS.clock}
            iconColor={DASH_CHART_COLORS.violet}
          />
          <StatCard
            label="Paiements à valider"
            value={counts.pendingCashValidations}
            href={ROUTES.agent.paymentsValidation}
            icon={DASH_STAT_ICONS.wallet}
            iconColor={DASH_CHART_COLORS.purple}
          />
          <StatCard
            label="Tickets maintenance"
            value={counts.openMaintenanceTickets}
            href={ROUTES.agent.maintenance}
            icon={DASH_STAT_ICONS.wrench}
            iconColor={DASH_CHART_COLORS.slate}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
        <div className="xl:col-span-8">
          <RevenueChart payments={chartPayments} />
        </div>
        <div className="xl:col-span-4">
          <PropertyModeChart
            data={modeSeries}
            emptyMessage="Aucun bien dans le portefeuille"
          />
        </div>
      </div>

      <DashboardMarketProperties role="agent" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ListDataTable
          title="Visites du jour"
          viewAllHref={ROUTES.agent.visits}
          compact
          columns={adaptSummaryColumns<AgentVisitRow>([
            { key: 'time', header: 'Heure', render: (row) => row.time },
            {
              key: 'property',
              header: 'Bien',
              render: (row) => (
                <span className="truncate font-medium">
                  {row.propertyTitle}
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
          ])}
          data={visits}
          emptyMessage={
            visitsError ? visitsError : 'Aucune visite aujourd’hui'
          }
          onRowClick={(row) =>
            router.push(ROUTES.agent.property(row.propertyId))
          }
        />

        <ListDataTable
          title="Paiements espèces"
          viewAllHref={ROUTES.agent.paymentsValidation}
          compact
          columns={adaptSummaryColumns<AgentPaymentRow>([
            {
              key: 'id',
              header: 'Réf.',
              render: (row) => (
                <Link
                  href={ROUTES.agent.payment(row.id)}
                  className="font-mono text-xs text-accent hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.id.slice(0, 8)}
                </Link>
              ),
            },
            {
              key: 'property',
              header: 'Bien',
              render: (row) => (
                <span className="truncate">{row.propertyTitle}</span>
              ),
            },
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
          ])}
          data={payments}
          emptyMessage={
            paymentsError ? paymentsError : 'Aucun paiement à valider'
          }
          onRowClick={(row) => router.push(ROUTES.agent.payment(row.id))}
        />
      </div>
    </section>
  );
}
