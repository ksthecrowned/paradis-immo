/**
 * Onboarding copy — inspired by Figma community kit:
 * @see resources/figma-design.md
 * https://www.figma.com/design/O7Qjja3hW6GUvYUyO99RkX/Real-Estate-App-Onboarding-Screens--Community-
 */

export type OnboardingSlide = {
  id: string;
  title: string;
  subtitle: string;
  /** Accent for illustration background */
  accent: string;
  emoji?: string;
  /** First slide — Paradis Immo logo instead of emoji */
  showLogo?: boolean;
};

export const ONBOARDING_SLIDES: OnboardingSlide[] = [
  {
    id: 'welcome',
    title: 'Bienvenue sur Paradis Immo',
    subtitle:
      'La plateforme immobilière du Congo : location, vente et gestion simplifiées.',
    accent: '#F0EFFB',
    showLogo: true,
  },
  {
    id: 'visits',
    title: 'Réservez une visite facilement',
    subtitle:
      'Choisissez un créneau, confirmez en ligne et visitez le bien en toute sérénité.',
    accent: '#F0EFFB',
    emoji: '📅',
  },
  {
    id: 'pay',
    title: 'Payez en toute confiance',
    subtitle:
      'Loyers et réservations via mobile money ou espèces, avec suivi transparent.',
    accent: '#E8E6F9',
    emoji: '💳',
  },
];
