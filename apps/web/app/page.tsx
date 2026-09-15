import type { Metadata } from 'next';
import { Fraunces, Manrope } from 'next/font/google';
import {
  LandingApp,
  LandingFooter,
  LandingHero,
  LandingJourneys,
  LandingManage,
  LandingNav,
  LandingProof,
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
    'Écosystème immobilier au Congo : découvrez des biens sur le web, poursuivez votre parcours dans l’application, pilotez votre patrimoine depuis l’espace de gestion.',
  icons: {
    icon: '/landing/logo.png',
    apple: '/landing/logo.png',
  },
  openGraph: {
    title: 'Paradis Immobilier',
    description:
      'Trouvez un bien sur le web. Vivez votre parcours dans l’application. Gérez votre patrimoine en ligne.',
    locale: 'fr_CG',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Paradis Immobilier',
    description:
      'Écosystème immobilier : découverte web, expérience mobile, gestion patrimoniale.',
  },
};

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'RealEstateAgent',
  name: 'Paradis Immobilier',
  description:
    'Écosystème immobilier : découverte de biens, application mobile et espace de gestion patrimoniale.',
  areaServed: {
    '@type': 'Country',
    name: 'Congo',
  },
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
        <LandingProof />
        <LandingJourneys />
        <LandingApp />
        <LandingManage />
      </main>
      <LandingFooter />
    </div>
  );
}
