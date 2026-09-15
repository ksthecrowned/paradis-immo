import Link from 'next/link';
import { LandingLogo } from './landing-logo';

export function LandingFooter(): React.JSX.Element {
  return (
    <footer className="bg-(--lp-navy) text-(--lp-on-navy)">
      <div className="landing-container flex flex-col gap-10 py-14 md:flex-row md:items-start md:justify-between md:py-16">
        <div className="max-w-sm">
          <LandingLogo textClassName="!text-(--lp-primary)" />
          <p className="mt-5 text-[15px] leading-relaxed text-(--lp-muted)">
            Des biens à découvrir. Un parcours dans l&apos;application. La
            gestion de patrimoine en ligne.
          </p>
        </div>

        <nav
          className="flex flex-wrap gap-x-8 gap-y-3 text-[15px]"
          aria-label="Pied de page"
        >
          <a
            href="/#properties"
            className="text-(--lp-muted) transition-colors hover:text-(--lp-on-navy)"
          >
            Biens
          </a>
          <a
            href="/#app"
            className="text-(--lp-muted) transition-colors hover:text-(--lp-on-navy)"
          >
            Application
          </a>
          <Link
            href="/login"
            className="text-(--lp-muted) transition-colors hover:text-(--lp-on-navy)"
          >
            Espace gestionnaire
          </Link>
          <Link
            href="/register"
            className="text-(--lp-muted) transition-colors hover:text-(--lp-on-navy)"
          >
            Créer mon espace
          </Link>
          <Link
            href="/privacy"
            className="text-(--lp-muted) transition-colors hover:text-(--lp-on-navy)"
          >
            Confidentialité
          </Link>
        </nav>
      </div>

      <div className="border-t border-white/10">
        <div className="landing-container flex flex-col gap-2 py-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-(--lp-muted)">
            ©{new Date().getFullYear()} Paradis Immobilier
          </p>
          <p className="text-sm text-(--lp-muted)">Congo</p>
        </div>
      </div>
    </footer>
  );
}
