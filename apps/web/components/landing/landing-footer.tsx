import Link from 'next/link';
import { LandingLogo } from './landing-logo';
import { LandingStoreBadges } from './landing-store-badges';

export function LandingFooter(): React.JSX.Element {
  return (
    <footer className="bg-[#12161a] text-(--lp-on-navy)">
      <div className="landing-container grid gap-12 py-16 md:grid-cols-[1.2fr_0.8fr_0.9fr] md:gap-10 md:py-20">
        <div>
          <LandingLogo textClassName="!text-(--lp-primary)" />
          <p className="mt-5 max-w-sm text-[15px] leading-relaxed text-(--lp-cool)">
            Immobilier au Congo — location, vente et gestion, du premier clic à
            la clé.
          </p>
          <div className="mt-8">
            <p className="mb-3 text-[12px] font-semibold tracking-[0.12em] uppercase text-(--lp-primary)">
              Application
            </p>
            <LandingStoreBadges size="md" />
          </div>
        </div>

        <nav aria-label="Explorer">
          <p className="text-[12px] font-semibold tracking-[0.12em] uppercase text-(--lp-primary)">
            Explorer
          </p>
          <ul className="mt-4 space-y-3 text-[15px]">
            <li>
              <a
                href="/#properties"
                className="text-(--lp-cool) transition-colors hover:text-(--lp-on-navy)"
              >
                Biens
              </a>
            </li>
            <li>
              <a
                href="/#paths"
                className="text-(--lp-cool) transition-colors hover:text-(--lp-on-navy)"
              >
                La plateforme
              </a>
            </li>
            <li>
              <a
                href="/#app"
                className="text-(--lp-cool) transition-colors hover:text-(--lp-on-navy)"
              >
                Application
              </a>
            </li>
            <li>
              <a
                href="/#manage"
                className="text-(--lp-cool) transition-colors hover:text-(--lp-on-navy)"
              >
                Gestion
              </a>
            </li>
          </ul>
        </nav>

        <nav aria-label="Espace professionnel">
          <p className="text-[12px] font-semibold tracking-[0.12em] uppercase text-(--lp-primary)">
            Professionnels
          </p>
          <ul className="mt-4 space-y-3 text-[15px]">
            <li>
              <Link
                href="/login"
                className="text-(--lp-cool) transition-colors hover:text-(--lp-on-navy)"
              >
                Espace gestionnaire
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="text-(--lp-cool) transition-colors hover:text-(--lp-on-navy)"
              >
                Créer mon espace
              </Link>
            </li>
            <li>
              <Link
                href="/privacy"
                className="text-(--lp-cool) transition-colors hover:text-(--lp-on-navy)"
              >
                Confidentialité
              </Link>
            </li>
          </ul>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="landing-container flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-(--lp-cool)">
            ©{new Date().getFullYear()} Paradis Immobilier
          </p>
          <p className="text-sm text-(--lp-cool)">Congo</p>
        </div>
      </div>
    </footer>
  );
}
