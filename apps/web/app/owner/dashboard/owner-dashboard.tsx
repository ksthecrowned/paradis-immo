/**
 * OwnerDashboard — propriétaire.
 */
import Link from 'next/link';
import {
  Building2,
  Calendar,
  FileText,
  Wallet,
} from 'lucide-react';
import {
  PageHeader,
  PropertyModeChart,
  RevenueChart,
  StatCard,
} from '@/components/dashboard';
import { ROUTES } from '@/lib/routes';

export interface OwnerDashboardCounts {
  properties: number | null;
  activeLeases: number | null;
  pendingPayments: number;
  visitRequests: number;
}

export function OwnerDashboard({
  counts,
}: {
  counts: OwnerDashboardCounts;
}): React.JSX.Element {
  return (
    <section className="space-y-6">
      <PageHeader
        title="Tableau de bord propriétaire"
        description="Vue d'ensemble de vos biens, baux et paiements."
        actions={
          <Link
            href={ROUTES.owner.propertiesAdd}
            className="inline-flex items-center justify-center rounded-lg bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent/90"
          >
            Ajouter un bien
          </Link>
        }
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Biens"
          value={counts.properties}
          hint={counts.properties === null ? 'Bientôt disponible' : undefined}
          href={ROUTES.owner.properties}
          icon={Building2}
        />
        <StatCard
          label="Baux actifs"
          value={counts.activeLeases}
          href={ROUTES.owner.leases}
          icon={FileText}
        />
        <StatCard
          label="Paiements en attente"
          value={counts.pendingPayments}
          href={ROUTES.owner.payments}
          icon={Wallet}
        />
        <StatCard
          label="Demandes de visite"
          value={counts.visitRequests}
          href={ROUTES.owner.visits}
          icon={Calendar}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart />
        </div>
        <PropertyModeChart />
      </div>
    </section>
  );
}
