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

export interface OwnerDashboardCounts {
  activeProperties: number;
  draftProperties: number;
  activeLeases: number;
  pendingPayments: number;
  overdueSchedules: number;
  pendingVisitRequests: number;
  openMaintenanceTickets: number;
  pendingApplications: number;
}

export interface OwnerPaymentRow {
  id: string;
  date: string;
  amount: string;
  status: string;
  method: string;
  propertyTitle: string;
}

export interface OwnerVisitRow {
  id: string;
  date: string;
  status: string;
  propertyId: string;
  propertyTitle: string;
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
  visitsError,
  paymentsError,
}: {
  counts: OwnerDashboardCounts;
  payments?: OwnerPaymentRow[];
  visits?: OwnerVisitRow[];
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
            value={counts.activeProperties}
            href={ROUTES.owner.properties}
            icon={DASH_STAT_ICONS.buildings}
            iconColor={DASH_CHART_COLORS.green}
          />
          <StatCard
            label="Brouillons"
            value={counts.draftProperties}
            href={ROUTES.owner.properties}
            icon={DASH_STAT_ICONS.document}
            iconColor={DASH_CHART_COLORS.slate}
          />
          <StatCard
            label="Baux actifs"
            value={counts.activeLeases}
            href={ROUTES.owner.leases}
            icon={DASH_STAT_ICONS.handshake}
            iconColor={DASH_CHART_COLORS.blue}
          />
          <StatCard
            label="Échéances en retard"
            value={counts.overdueSchedules}
            href={ROUTES.owner.arrears}
            icon={DASH_STAT_ICONS.bills}
            iconColor={DASH_CHART_COLORS.rose}
          />
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted">À traiter</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Paiements en attente"
            value={counts.pendingPayments}
            href={ROUTES.owner.payments}
            icon={DASH_STAT_ICONS.wallet}
            iconColor={DASH_CHART_COLORS.amber}
          />
          <StatCard
            label="Demandes de visite"
            value={counts.pendingVisitRequests}
            href={ROUTES.owner.visits}
            icon={DASH_STAT_ICONS.calendar}
            iconColor={DASH_CHART_COLORS.violet}
          />
          <StatCard
            label="Tickets maintenance"
            value={counts.openMaintenanceTickets}
            href={ROUTES.owner.maintenance}
            icon={DASH_STAT_ICONS.wrench}
            iconColor={DASH_CHART_COLORS.teal}
          />
          <StatCard
            label="Candidatures"
            value={counts.pendingApplications}
            href={ROUTES.owner.applications}
            icon={DASH_STAT_ICONS.bag}
            iconColor={DASH_CHART_COLORS.purple}
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

      <DashboardMarketProperties role="owner" />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <ListDataTable
          title="Dernières demandes de visite"
          viewAllHref={ROUTES.owner.visits}
          compact
          columns={adaptSummaryColumns<OwnerVisitRow>([
            { key: 'date', header: 'Date', render: (row) => row.date },
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
            visitsError ? visitsError : 'Aucune demande de visite'
          }
          onRowClick={(row) =>
            router.push(ROUTES.owner.property(row.propertyId))
          }
        />

        <ListDataTable
          title="Derniers paiements"
          viewAllHref={ROUTES.owner.payments}
          compact
          columns={adaptSummaryColumns<OwnerPaymentRow>([
            {
              key: 'id',
              header: 'Réf.',
              render: (row) => (
                <Link
                  href={ROUTES.owner.payment(row.id)}
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
            paymentsError ? paymentsError : 'Aucun paiement récent'
          }
          onRowClick={(row) => router.push(ROUTES.owner.payment(row.id))}
        />
      </div>
    </section>
  );
}
