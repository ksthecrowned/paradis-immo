import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import {
  LandingApp,
  LandingEditorial,
  LandingFooter,
  LandingHero,
  LandingManage,
  LandingNav,
  LandingProperties,
} from '@/components/landing';
import './landing.css';

const display = Fraunces({
  subsets: ['latin'],
  variable: '--font-lp-display',
  display: 'swap',
  weight: ['400', '500', '600'],
});

const sans = Manrope({
  subsets: ['latin'],
  variable: '--font-lp-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

export const metadata: Metadata = {
  title: 'Paradis Immobilier — Découvrir, louer, gérer',
  description:
    'Trouvez un bien au Congo. Visites et suivi dans l’application. Gérez votre patrimoine en ligne.',
  icons: {
    icon: '/landing/logo.png',
    apple: '/landing/logo.png',
  },
  openGraph: {
    title: 'Paradis Immobilier',
    description:
      'Location, vente et gestion immobilière — des biens disponibles, maintenant.',
    locale: 'fr_CG',
    type: 'website',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Paradis Immobilier',
  description: 'Location, vente et gestion immobilière au Congo.',
  areaServed: { '@type': 'Country', name: 'Congo' },
};

export default function HomePage(): React.JSX.Element {
  return (
    <div
      className={`landing min-h-screen antialiased ${display.variable} ${sans.variable}`}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <LandingNav />
      <main>
        <LandingHero />
        <LandingProperties />
        <LandingEditorial />
        <LandingApp />
        <LandingManage />
      </main>
      <LandingFooter />
    </div>
  );
}
