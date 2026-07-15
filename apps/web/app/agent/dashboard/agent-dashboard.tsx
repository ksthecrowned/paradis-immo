'use client';

import {
  DataTable,
  PropertyModeChart,
  RevenueChart,
  SessionsMapCard,
  StatCard,
  StatusBadge,
} from '@/components/dashboard';
import { DASH_CHART_COLORS, DASH_STAT_ICONS } from '@/lib/dash-icons';
import { ROUTES } from '@/lib/routes';

const DEMO_VISITS = [
  { id: 'v1', time: '09:00', property: 'Appart. Poto-Poto', tenant: 'Marie K.', status: 'PENDING' },
  { id: 'v2', time: '11:30', property: 'Villa Bacongo', tenant: 'Jean M.', status: 'CONFIRMED' },
  { id: 'v3', time: '14:00', property: 'Studio Moungali', tenant: 'Amina N.', status: 'PENDING' },
  { id: 'v4', time: '16:30', property: 'Maison Talangaï', tenant: 'Paul O.', status: 'CONFIRMED' },
];

const DEMO_PAYMENTS = [
  { id: 'p1', tenant: 'Marie K.', property: 'Appart. Poto-Poto', amount: '150 000 XAF', date: '27 juin' },
  { id: 'p2', tenant: 'Jean M.', property: 'Villa Bacongo', amount: '450 000 XAF', date: '26 juin' },
  { id: 'p3', tenant: 'Amina N.', property: 'Studio Moungali', amount: '75 000 XAF', date: '26 juin' },
];

function visitTone(status: string): 'success' | 'warning' | 'danger' | 'neutral' {
  if (status === 'CONFIRMED') return 'success';
  if (status === 'PENDING') return 'warning';
  return 'neutral';
}

function visitLabel(status: string): string {
  return status === 'CONFIRMED' ? 'Confirmée' : 'En attente';
}

export function AgentDashboard(): React.JSX.Element {
  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Biens mandatés"
          value={24}
          href={ROUTES.agent.portfolio}
          icon={DASH_STAT_ICONS.buildings}
          sparkline={[18, 19, 20, 21, 22, 23, 24]}
        />
        <StatCard
          label="Visites aujourd'hui"
          value={6}
          href={ROUTES.agent.visits}
          icon={DASH_STAT_ICONS.calendar}
          sparkline={[3, 4, 5, 4, 6, 5, 6]}
          sparklineColor={DASH_CHART_COLORS.green}
        />
        <StatCard
          label="Paiements à valider"
          value={3}
          href={ROUTES.agent.paymentsValidation}
          icon={DASH_STAT_ICONS.wallet}
          sparkline={[1, 2, 1, 3, 2, 4, 3]}
          sparklineColor={DASH_CHART_COLORS.amber}
        />
        <StatCard
          label="Tickets maintenance"
          value={5}
          href={ROUTES.agent.maintenance}
          icon={DASH_STAT_ICONS.wrench}
          sparkline={[2, 3, 4, 3, 5, 4, 5]}
          sparklineColor={DASH_CHART_COLORS.violet}
        />
      </div>

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

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <DataTable
          title="Visites du jour"
          viewAllHref={ROUTES.agent.visits}
          columns={[
            { key: 'time', header: 'Heure', render: (row) => row.time },
            { key: 'property', header: 'Bien', render: (row) => row.property },
            { key: 'tenant', header: 'Visiteur', render: (row) => row.tenant },
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
          rows={DEMO_VISITS}
        />

        <DataTable
          title="Paiements espèces"
          viewAllHref={ROUTES.agent.paymentsValidation}
          columns={[
            { key: 'tenant', header: 'Locataire', render: (row) => row.tenant },
            { key: 'property', header: 'Bien', render: (row) => row.property },
            {
              key: 'amount',
              header: 'Montant',
              render: (row) => (
                <span className="font-medium">{row.amount}</span>
              ),
            },
            { key: 'date', header: 'Date', render: (row) => row.date },
          ]}
          rows={DEMO_PAYMENTS}
        />
      </div>
    </section>
  );
}
