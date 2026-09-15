import Link from 'next/link';

/**
 * Owner/manager pitch — inspired by Foncia / Masteos / SG « confier mon patrimoine »:
 * one promise, three outcomes, clear CTAs. Not a feature dump.
 */
const OUTCOMES = [
  {
    title: 'Vos biens, visibles',
    body: 'Publiez location, courte durée ou vente — et gardez le portefeuille à jour.',
  },
  {
    title: 'Le quotidien, suivi',
    body: 'Visites, réservations, baux et locataires au même endroit.',
  },
  {
    title: 'Les ventes, structurées',
    body: 'Suivez chaque dossier jusqu’à la conclusion, sans disperser l’info.',
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
        <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-end lg:gap-20">
          <div>
            <p className="lp-eyebrow">Propriétaires &amp; agents</p>
            <h2
              id="manage-heading"
              className="mt-3 text-[2rem] leading-tight text-(--lp-ink) md:text-[2.75rem]"
            >
              La gestion, sans le chaos.
            </h2>
            <p className="mt-4 max-w-lg text-[15px] leading-relaxed text-(--lp-muted) md:text-base">
              Un espace web pour piloter votre activité — pendant que locataires
              et acheteurs poursuivent leur parcours dans l&apos;application.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/login" className="landing-btn landing-btn-primary">
                Accéder à l&apos;espace gestionnaire
              </Link>
              <Link href="/register" className="landing-btn landing-btn-outline">
                Créer mon espace gestionnaire
              </Link>
            </div>
          </div>

          <ol className="border-t border-(--lp-border)">
            {OUTCOMES.map((item, i) => (
              <li
                key={item.title}
                className="grid grid-cols-[3rem_1fr] gap-4 border-b border-(--lp-border) py-6"
              >
                <span className="pt-0.5 font-mono text-sm text-(--lp-primary)">
                  0{i + 1}
                </span>
                <div>
                  <h3 className="text-base font-semibold text-(--lp-ink)">
                    {item.title}
                  </h3>
                  <p className="mt-1.5 text-[14px] leading-relaxed text-(--lp-muted)">
                    {item.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
