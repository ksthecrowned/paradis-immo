/**
 * Paradis Immo mobile tokens.
 * Brand palette aligned with web (`apps/web/app/globals.css` / `landing.css`).
 * Charbon #171C21 · Champagne #D6B77C · Ivoire #F1E6D0 · Bleu-gris #8FA9B8
 * Active scheme comes from bootstrap (`global.__PARADIS_THEME__`) set before
 * expo-router loads, so StyleSheets pick the right palette.
 */
export const lightColors = {
  /** Champagne sable — signature */
  primary: '#D6B77C',
  primaryHover: '#C4A56A',
  primarySoft: '#EFE4CF',
  primaryMuted: '#F5EDD9',
  navy: '#FFFFFF',
  /** Charbon profond */
  ink: '#171C21',
  /** Bleu-gris désaturé */
  muted: '#8FA9B8',
  border: '#E5D9C4',
  surface: '#FFFFFF',
  /** Ivoire chaud */
  bg: '#F1E6D0',
  search: '#FFFFFF',
  onPrimary: '#171C21',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#F5A623',
  warningSoft: '#FEF3C7',
} as const;

/** Dark Premium — charbon + champagne + ivoire */
export const darkColors = {
  primary: '#D6B77C',
  primaryHover: '#C4A56A',
  primarySoft: 'rgba(214, 183, 124, 0.22)',
  primaryMuted: 'rgba(214, 183, 124, 0.15)',
  navy: '#1D2329',
  ink: '#F1E6D0',
  muted: '#8FA9B8',
  border: '#272F37',
  surface: '#242B33',
  bg: '#171C21',
  search: '#232A31',
  onPrimary: '#171C21',
  danger: '#EF4444',
  success: '#22C997',
  warning: '#F5A623',
  warningSoft: 'rgba(245, 166, 35, 0.18)',
} as const;

export type ThemeColors = {
  -readonly [K in keyof typeof darkColors]: string;
};

export type ColorScheme = 'light' | 'dark';

declare global {
  // eslint-disable-next-line no-var
  var __PARADIS_THEME__: ColorScheme | undefined;
}

export function getBootColorScheme(): ColorScheme {
  return globalThis.__PARADIS_THEME__ === 'light' ? 'light' : 'dark';
}

export function paletteFor(scheme: ColorScheme): ThemeColors {
  return {
    ...(scheme === 'light' ? lightColors : darkColors),
  };
}

/** Active palette — set at module load from bootstrap scheme. */
export const colors: ThemeColors = paletteFor(getBootColorScheme());

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  full: 9999,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const shadows = {
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: getBootColorScheme() === 'dark' ? 0.35 : 0.06,
    shadowRadius: getBootColorScheme() === 'dark' ? 16 : 20,
    elevation: getBootColorScheme() === 'dark' ? 4 : 3,
  },
} as const;
