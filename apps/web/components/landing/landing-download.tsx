import Link from 'next/link';
import { LandingStoreBadges } from './landing-store-badges';

export function LandingDownload(): React.JSX.Element {
  return (
    <section
      id="download"
      className="bg-[var(--lp-navy)] py-16 text-[var(--lp-on-primary)] md:py-24"
    >
      <div className="landing-container grid items-center gap-10 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <h2 className="text-[32px] font-bold leading-tight md:text-[44px]">
            Téléchargez l&apos;application Paradis Immo
          </h2>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-white/75 md:text-base">
            Cherchez un logement, planifiez une visite, payez votre loyer et
            recevez vos notifications — sur iPhone et Android.
          </p>
          <LandingStoreBadges onDark className="mt-8" />
        </div>

        <div className="rounded-[var(--lp-radius-xl)] border border-white/10 bg-white/5 p-6 backdrop-blur-sm md:p-8">
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--lp-primary)]">
            Sur mobile
          </p>
          <ul className="mt-5 space-y-3 text-[15px] text-white/75">
            <li>• Catalogue location / vente avec filtres locaux</li>
            <li>• Visites, réservations et favoris</li>
            <li>• Paiements et reçus depuis l’app</li>
          </ul>
          <p className="mt-6 text-sm text-white/65">
            Propriétaire ou agent ?{' '}
            <Link
              href="/login"
              className="font-semibold text-white hover:underline"
            >
              Connectez-vous au dashboard web
            </Link>
            .
          </p>
        </div>
      </div>
    </section>
  );
}
