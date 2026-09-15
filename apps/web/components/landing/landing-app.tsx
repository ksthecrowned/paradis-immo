import { hasStoreLinks } from '@/lib/store-links';
import { LandingStoreBadges } from './landing-store-badges';

/**
 * Only mounts when store URLs exist — no “coming soon” monument.
 */
export function LandingApp(): React.JSX.Element | null {
  if (!hasStoreLinks()) return null;

  return (
    <section
      id="app"
      className="border-y border-white/10 bg-[#171c21] py-12 text-(--lp-on-navy) md:py-14"
      aria-labelledby="app-heading"
    >
      <div className="landing-container flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center">
        <div>
          <h2
            id="app-heading"
            className="text-xl font-semibold tracking-tight md:text-2xl"
          >
            Téléchargez l&apos;application
          </h2>
          <p className="mt-1 text-[15px] text-(--lp-muted)">
            Visites, réservations et suivi — sur iPhone et Android.
          </p>
        </div>
        <LandingStoreBadges onDark />
      </div>
    </section>
  );
}
