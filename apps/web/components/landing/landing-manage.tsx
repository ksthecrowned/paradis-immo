import Link from 'next/link';

const OUTCOMES = [
  {
    title: 'Vos biens, visibles',
    body: 'Publiez location, courte durée ou vente.',
  },
  {
    title: 'Le quotidien, suivi',
    body: 'Visites, réservations, baux et locataires.',
  },
  {
    title: 'Les ventes, structurées',
    body: 'Chaque dossier jusqu’à la conclusion.',
  },
] as const;

export function LandingManage(): React.JSX.Element {
  return (
    <section
      id="manage"
      className="bg-(--lp-bg) py-20 md:py-28"
      aria-labelledby="manage-heading"
    >
      <div className="landing-container">
        <div className="max-w-xl">
          <p className="lp-eyebrow">Gestion</p>
          <h2
            id="manage-heading"
            className="mt-3 text-[2rem] leading-tight text-(--lp-ink) md:text-[2.75rem]"
          >
            La gestion, sans le chaos.
          </h2>
        </div>

        <ol className="mt-12 grid gap-0 border-t border-(--lp-border) sm:grid-cols-3">
          {OUTCOMES.map((item, i) => (
            <li
              key={item.title}
              className="border-b border-(--lp-border) py-7 sm:border-e sm:border-b-0 sm:px-6 sm:first:ps-0 sm:last:border-e-0 sm:last:pe-0"
            >
              <span className="font-mono text-sm text-(--lp-primary)">
                0{i + 1}
              </span>
              <h3 className="mt-3 text-base font-semibold text-(--lp-ink)">
                {item.title}
              </h3>
              <p className="mt-2 text-[14px] leading-relaxed text-(--lp-muted)">
                {item.body}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-12 flex flex-col gap-3 sm:flex-row sm:items-center">
          <Link href="/login" className="landing-btn landing-btn-primary">
            Accéder à l&apos;espace gestionnaire
          </Link>
          <Link href="/register" className="landing-btn landing-btn-outline">
            Créer mon espace gestionnaire
          </Link>
        </div>
      </div>
    </section>
  );
}
