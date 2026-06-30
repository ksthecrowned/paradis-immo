/**
 * OwnerDashboard — propriétaire squelette.
 *
 * Affiche les 4 compteurs clés du tableau de bord propriétaire :
 *  - Biens (avec placeholder "Bientôt disponible" tant que
 *    /properties/mine n'est pas exposé par l'API)
 *  - Baux actifs
 *  - Paiements en attente
 *  - Demandes de visite
 *
 * Et le CTA "Ajouter un bien" vers /proprietaire/biens/nouveau.
 *
 * Pure composant de présentation : la page qui le consomme se
 * charge d'aller chercher les compteurs via `apiFetch` puis de
 * les passer via la prop `counts`. Cela garde le composant
 * trivialement testable (renderToStaticMarkup, sans jsdom).
 */
import Link from 'next/link';

export interface OwnerDashboardCounts {
  /** null = pas encore d'endpoint propriétaire exposé. */
  properties: number | null;
  /** null = pas encore d'endpoint propriétaire exposé. */
  activeLeases: number | null;
  pendingPayments: number;
  visitRequests: number;
}

interface CardSpec {
  label: string;
  value: number | null;
  /** Petit message affiché sous la valeur (ex. "Bientôt disponible"). */
  hint?: string;
  href?: string;
  cta?: string;
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
      href: '/proprietaire/biens',
    },
    {
      label: 'Baux actifs',
      value: counts.activeLeases,
      href: '/proprietaire/baux',
    },
    {
      label: 'Paiements en attente',
      value: counts.pendingPayments,
      href: '/proprietaire/paiements',
    },
    {
      label: 'Demandes de visite',
      value: counts.visitRequests,
      href: '/proprietaire/visites',
    },
  ];

  return (
    <section className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Tableau de bord propriétaire
          </h1>
          <p className="mt-1 text-sm text-gray-500 dark:text-neutral-400">
            Vue d&apos;ensemble de vos biens, baux et paiements.
          </p>
        </div>
        <Link
          href="/proprietaire/biens/nouveau"
          className="inline-flex items-center justify-center gap-x-2 rounded-lg border border-transparent bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Ajouter un bien
        </Link>
      </header>

      <div
        data-testid="owner-stats"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        {cards.map((card) => (
          <StatCard key={card.label} card={card} />
        ))}
      </div>
    </section>
  );
}

function StatCard({ card }: { card: CardSpec }): React.JSX.Element {
  const inner = (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-800">
      <p className="text-sm font-medium text-gray-500 dark:text-neutral-400">
        {card.label}
      </p>
      <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">
        {card.value === null ? '—' : card.value}
      </p>
      {card.hint ? (
        <p className="mt-2 text-xs text-gray-500 dark:text-neutral-500">
          {card.hint}
        </p>
      ) : null}
    </div>
  );
  if (card.href) {
    return (
      <a href={card.href} className="block focus:outline-none focus:ring-2 focus:ring-blue-500">
        {inner}
      </a>
    );
  }
  return inner;
}
