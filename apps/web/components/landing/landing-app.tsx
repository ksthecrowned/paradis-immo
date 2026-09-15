import { hasStoreLinks } from '@/lib/store-links';
import { LandingStoreBadges } from './landing-store-badges';

export function LandingApp(): React.JSX.Element {
  const storesReady = hasStoreLinks();

  return (
    <section
      id="app"
      className="bg-[#171c21] py-20 text-(--lp-on-navy) md:py-28"
      aria-labelledby="app-heading"
    >
      <div className="landing-container flex flex-col items-start gap-8 md:flex-row md:items-end md:justify-between md:gap-16">
        <div className="max-w-xl">
          <p className="lp-eyebrow">Application</p>
          <h2
            id="app-heading"
            className="mt-3 text-[2rem] leading-tight md:text-[2.75rem]"
          >
            {storesReady
              ? 'Téléchargez l’application'
              : 'L’application arrive bientôt'}
          </h2>
          <p className="mt-5 text-[15px] leading-relaxed text-(--lp-muted) md:text-base">
            Visites, réservations, favoris et notifications — tout le parcours
            personnel, sur iPhone et Android.
          </p>
        </div>
        <LandingStoreBadges onDark className="shrink-0" />
      </div>
    </section>
  );
}
