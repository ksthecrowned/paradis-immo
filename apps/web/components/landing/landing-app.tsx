import Image from 'next/image';
import { LandingStoreBadges } from './landing-store-badges';

const APP_POINTS = [
  'Parcourir les biens disponibles',
  'Planifier une visite',
  'Suivre réservations et paiements',
] as const;

/**
 * Full App CTA — phone stage + store badges. Always mounted.
 */
export function LandingApp(): React.JSX.Element {
  return (
    <section
      id="app"
      className="landing-app relative overflow-hidden bg-[#171c21] py-20 text-(--lp-on-navy) md:py-28"
      aria-labelledby="app-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_20%_0%,rgba(214,183,124,0.14),transparent_50%),radial-gradient(ellipse_at_90%_80%,rgba(143,169,184,0.1),transparent_45%)]"
        aria-hidden
      />
      <div className="landing-grain pointer-events-none absolute inset-0 opacity-[0.35]" aria-hidden />

      <div className="landing-container relative grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-20">
        <div>
          <p className="lp-eyebrow">Application</p>
          <h2
            id="app-heading"
            className="mt-4 max-w-lg text-[2.15rem] leading-[1.08] md:text-[2.85rem]"
          >
            Votre parcours immobilier,
            <span className="text-(--lp-primary)"> dans la poche.</span>
          </h2>
          <p className="mt-5 max-w-md text-[16px] leading-relaxed text-(--lp-cool)">
            Cherchez, visitez, réservez et suivez — le quotidien locataire et
            acheteur vit dans l&apos;app. La gestion reste sur le web.
          </p>

          <ul className="mt-8 space-y-3.5">
            {APP_POINTS.map((point) => (
              <li
                key={point}
                className="flex items-start gap-3 text-[15px] text-(--lp-on-navy)"
              >
                <span
                  className="mt-1.5 size-1.5 shrink-0 rounded-full bg-(--lp-primary)"
                  aria-hidden
                />
                {point}
              </li>
            ))}
          </ul>

          <div className="mt-10">
            <LandingStoreBadges size="lg" />
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[320px] lg:max-w-[360px]">
          <div
            className="absolute -inset-10 rounded-full bg-(--lp-primary)/10 blur-3xl"
            aria-hidden
          />
          <div className="landing-phone relative mx-auto">
            <div className="landing-phone-bezel">
              <div className="landing-phone-notch" aria-hidden />
              <div className="landing-phone-screen">
                <div className="relative h-[42%] overflow-hidden">
                  <Image
                    src="/landing/hero-house.png"
                    alt=""
                    fill
                    className="object-cover"
                    sizes="360px"
                    priority={false}
                  />
                  <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#171c21] to-transparent" />
                  <span className="absolute start-4 top-4 rounded-full bg-(--lp-primary) px-3 py-1 text-[11px] font-bold text-(--lp-on-primary)">
                    Location
                  </span>
                </div>
                <div className="flex flex-1 flex-col gap-3 bg-[#171c21] px-5 pb-6 pt-4">
                  <p className="text-[11px] font-medium text-(--lp-cool)">
                    Brazzaville · Centre-ville
                  </p>
                  <p className="text-xl font-bold tracking-tight text-(--lp-primary)">
                    450 000 FCFA
                    <span className="text-sm font-semibold text-(--lp-cool)">
                      {' '}
                      / mois
                    </span>
                  </p>
                  <p className="text-[15px] font-semibold text-(--lp-on-navy)">
                    Appartement lumineux
                  </p>
                  <div className="mt-1 flex gap-2">
                    {['3 ch.', '120 m²', '3e'].map((chip) => (
                      <span
                        key={chip}
                        className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[10px] font-semibold text-(--lp-cool)"
                      >
                        {chip}
                      </span>
                    ))}
                  </div>
                  <div className="mt-auto flex gap-2 pt-4">
                    <span className="flex-1 rounded-lg bg-(--lp-primary) py-2.5 text-center text-[12px] font-bold text-(--lp-on-primary)">
                      Planifier une visite
                    </span>
                    <span
                      className="flex size-10 items-center justify-center rounded-lg border border-white/15 text-(--lp-on-navy)"
                      aria-hidden
                    >
                      <svg
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      >
                        <path d="M12 21s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 11c0 5.5-7 10-7 10z" />
                      </svg>
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
