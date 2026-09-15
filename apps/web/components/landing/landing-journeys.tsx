import Link from 'next/link';

export function LandingJourneys(): React.JSX.Element {
  return (
    <section
      id="journeys"
      className="border-y border-(--lp-border) bg-(--lp-surface) py-20 md:py-28"
      aria-labelledby="journeys-heading"
    >
      <div className="landing-container">
        <div className="max-w-xl">
          <p className="lp-eyebrow">Deux portes</p>
          <h2
            id="journeys-heading"
            className="mt-3 text-[2rem] leading-tight text-(--lp-ink) md:text-[2.75rem]"
          >
            Chercher un bien.
            <br />
            Ou confier votre patrimoine.
          </h2>
        </div>

        <div className="mt-14 grid gap-0 lg:grid-cols-2">
          <article className="border-t border-(--lp-border) py-10 lg:border-t-0 lg:border-e lg:pe-14 lg:py-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-(--lp-muted) uppercase">
              Locataires &amp; acheteurs
            </p>
            <h3 className="mt-4 text-[1.65rem] leading-snug text-(--lp-ink) md:text-[1.85rem]">
              Explorez les biens ici, puis ouvrez l&apos;application pour les
              visites et le suivi.
            </h3>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#properties" className="landing-btn landing-btn-primary">
                Voir les biens
              </a>
              <a href="#app" className="landing-btn landing-btn-outline">
                Télécharger l&apos;application
              </a>
            </div>
          </article>

          <article className="border-t border-(--lp-border) py-10 lg:border-t-0 lg:ps-14 lg:py-0">
            <p className="text-xs font-semibold tracking-[0.14em] text-(--lp-muted) uppercase">
              Propriétaires &amp; agents
            </p>
            <h3 className="mt-4 text-[1.65rem] leading-snug text-(--lp-ink) md:text-[1.85rem]">
              Publiez, organisez et suivez votre activité depuis l&apos;espace
              de gestion.
            </h3>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/login" className="landing-btn landing-btn-navy">
                Confier mon patrimoine
              </Link>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
