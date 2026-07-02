/**
 * OwnerDashboard — propriétaire squelette.
 */
import Link from 'next/link';
import { ROUTES } from '@/lib/routes';

export interface OwnerDashboardCounts {
  properties: number | null;
  activeLeases: number | null;
  pendingPayments: number;
  visitRequests: number;
}

interface CardSpec {
  label: string;
  value: number | null;
  hint?: string;
  href?: string;
}

export function OwnerDashboard({
  counts,
}: {
  counts: OwnerDashboardCounts;
}): React.JSX.Element {
  const cards: CardSpec[] = [
    {
      label: 'Biens',
      value: counts.properties,
      hint: counts.properties === null ? 'Bientôt disponible' : undefined,
      href: ROUTES.owner.properties,
    },
    {
      label: 'Baux actifs',
      value: counts.activeLeases,
      href: ROUTES.owner.leases,
    },
    {
      label: 'Paiements en attente',
      value: counts.pendingPayments,
      href: ROUTES.owner.payments,
    },
    {
      label: 'Demandes de visite',
      value: counts.visitRequests,
      href: ROUTES.owner.visits,
    },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-dash-text">
            Tableau de bord propriétaire
          </h1>
          <p className="mt-1 text-sm text-dash-text-muted">
            Vue d&apos;ensemble de vos biens, baux et paiements.
          </p>
        </div>
        <Link
          href={ROUTES.owner.propertiesAdd}
          className="inline-flex items-center justify-center gap-x-2 rounded-lg border border-transparent bg-dash-accent px-4 py-2 text-sm font-semibold text-white hover:bg-dash-accent/90"
        >
          Ajouter un bien
        </Link>
      </header>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <StatCard key={card.label} card={card} />
        ))}
      </div>
    </section>
  );
}

function StatCard({ card }: { card: CardSpec }): React.JSX.Element {
  const inner = (
    <div className="rounded-xl border border-dash-border bg-dash-card p-5 shadow-sm transition-colors hover:border-dash-accent/30">
      <p className="text-sm font-medium text-dash-text-muted">{card.label}</p>
      <p className="mt-2 text-3xl font-semibold text-dash-text">
        {card.value === null ? '—' : card.value}
      </p>
      {card.hint ? (
        <p className="mt-2 text-xs text-dash-text-muted">{card.hint}</p>
      ) : null}
    </div>
  );
  if (card.href) {
    return (
      <Link href={card.href} className="block focus:outline-none focus:ring-2 focus:ring-dash-accent">
        {inner}
      </Link>
    );
  }
  return inner;
}
