/**
 * Paradis Immo mobile tokens.
 * Dark palette aligned with web dashboard (`apps/web/app/globals.css`).
 * Active scheme comes from bootstrap (`global.__PARADIS_THEME__`) set before
 * expo-router loads, so StyleSheets pick the right palette.
 */
export const lightColors = {
  primary: '#7065F0',
  primaryHover: '#5A50D6',
  primarySoft: '#E8E6F9',
  primaryMuted: '#F0EFFB',
  navy: '#FFFFFF',
  ink: '#000929',
  muted: '#6C727F',
  border: '#E0DEF7',
  surface: '#FFFFFF',
  bg: '#F7F7FD',
  search: '#FFFFFF',
  onPrimary: '#FFFFFF',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#F5A623',
  warningSoft: '#FEF3C7',
} as const;

/** Dashboard dark (Darkone). */
export const darkColors = {
  primary: '#7065F0',
  primaryHover: '#5A50D6',
  primarySoft: 'rgba(112, 101, 240, 0.22)',
  primaryMuted: 'rgba(112, 101, 240, 0.15)',
  navy: '#1D2329',
  ink: '#F1F1F1',
  muted: '#AFB9CF',
  border: '#272F37',
  surface: '#242B33',
  bg: '#171C21',
  search: '#232A31',
  onPrimary: '#FFFFFF',
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
