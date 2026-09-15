import Image from 'next/image';
import Link from 'next/link';

/**
 * Editorial photo block — real imagery as content, not a full-bleed hero veil.
 */
export function LandingEditorial(): React.JSX.Element {
  return (
    <section
      className="bg-(--lp-bg) py-6 md:py-16"
      aria-labelledby="editorial-heading"
    >
      <div className="landing-container overflow-hidden md:rounded-(--lp-radius-xl) md:shadow-(--lp-shadow-float)">
        <div className="grid items-stretch gap-0 lg:grid-cols-2">
          <div className="relative min-h-[300px] lg:min-h-[460px]">
            <Image
              src="/landing/welcome-bg.png"
              alt="Intérieur résidentiel — Paradis Immobilier"
              fill
              className="object-cover"
              sizes="(max-width: 1024px) 100vw, 50vw"
            />
          </div>
          <div className="flex flex-col justify-center bg-[#171c21] px-8 py-14 text-(--lp-on-navy) md:px-12 md:py-16">
            <p className="lp-eyebrow">Patrimoine</p>
            <h2
              id="editorial-heading"
              className="mt-3 text-[2rem] leading-tight md:text-[2.55rem]"
            >
              Vous gérez des biens.
              <br />
              On vous laisse le pilotage.
            </h2>
            <p className="mt-5 max-w-md text-[15px] leading-relaxed text-(--lp-cool)">
              Publiez, suivez visites et baux, structurez vos ventes — depuis
              l&apos;espace gestionnaire.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Link href="/login" className="landing-btn landing-btn-primary">
                Espace gestionnaire
              </Link>
              <a href="#manage" className="landing-btn landing-btn-ghost">
                Voir ce que vous pilotez
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
