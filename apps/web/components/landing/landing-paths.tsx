import Link from 'next/link';
import { DashIcon } from '@/components/dash-icon';

/**
 * Dual audience — two clear doors, no fluff.
 */
export function LandingPaths(): React.JSX.Element {
  return (
    <section
      id="paths"
      className="bg-(--lp-bg) py-20 md:py-28"
      aria-labelledby="paths-heading"
    >
      <div className="landing-container">
        <div className="mx-auto max-w-2xl text-center">
          <p className="lp-eyebrow">La plateforme</p>
          <h2
            id="paths-heading"
            className="mt-4 text-[2rem] leading-tight text-(--lp-ink) md:text-[2.75rem]"
          >
            Deux portes. Un écosystème.
          </h2>
          <p className="mt-4 text-[16px] leading-relaxed text-(--lp-muted)">
            Cherchez un bien dans l&apos;application. Gérez votre patrimoine
            depuis l&apos;espace web.
          </p>
        </div>

        <div className="mt-14 grid gap-5 lg:grid-cols-2 lg:gap-7">
          <a
            href="#app"
            className="landing-path-card group relative overflow-hidden rounded-(--lp-radius-xl) bg-[#171c21] p-8 text-(--lp-on-navy) md:p-10"
          >
            <div
              className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-(--lp-primary)/15 blur-2xl transition-opacity group-hover:opacity-100"
              aria-hidden
            />
            <div className="relative">
              <span className="inline-flex size-12 items-center justify-center rounded-(--lp-radius-md) border border-white/10 bg-white/5">
                <DashIcon
                  icon="solar:smartphone-2-linear"
                  className="size-6 text-(--lp-primary)"
                />
              </span>
              <p className="mt-8 text-[12px] font-semibold tracking-[0.14em] uppercase text-(--lp-primary)">
                Locataires &amp; acheteurs
              </p>
              <h3 className="lp-display mt-3 text-[1.75rem] leading-tight md:text-[2rem]">
                Trouvez. Visitez. Emménagez.
              </h3>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-(--lp-cool)">
                Parcourez les annonces, planifiez une visite, suivez réservations
                et paiements — tout dans l&apos;app.
              </p>
              <span className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-(--lp-primary) transition-transform group-hover:translate-x-1">
                Télécharger l&apos;application
                <DashIcon
                  icon="solar:arrow-right-linear"
                  className="size-4"
                />
              </span>
            </div>
          </a>

          <Link
            href="/login"
            className="landing-path-card group relative overflow-hidden rounded-(--lp-radius-xl) border border-(--lp-border) bg-(--lp-surface) p-8 text-(--lp-ink) shadow-(--lp-shadow-card) md:p-10"
          >
            <div
              className="pointer-events-none absolute -end-16 -top-16 size-56 rounded-full bg-(--lp-primary)/20 blur-2xl opacity-70 transition-opacity group-hover:opacity-100"
              aria-hidden
            />
            <div className="relative">
              <span className="inline-flex size-12 items-center justify-center rounded-(--lp-radius-md) border border-(--lp-border) bg-(--lp-primary-muted)">
                <DashIcon
                  icon="solar:buildings-2-linear"
                  className="size-6 text-(--lp-ink)"
                />
              </span>
              <p className="mt-8 text-[12px] font-semibold tracking-[0.14em] uppercase text-(--lp-primary)">
                Propriétaires &amp; agents
              </p>
              <h3 className="lp-display mt-3 text-[1.75rem] leading-tight md:text-[2rem]">
                Publiez. Suivez. Concluez.
              </h3>
              <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-(--lp-muted)">
                Annonces, visites, baux et dossiers de vente — pilotés depuis
                l&apos;espace gestionnaire.
              </p>
              <span className="mt-8 inline-flex items-center gap-2 text-[14px] font-semibold text-(--lp-ink) transition-transform group-hover:translate-x-1">
                Accéder à l&apos;espace gestionnaire
                <DashIcon
                  icon="solar:arrow-right-linear"
                  className="size-4"
                />
              </span>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
