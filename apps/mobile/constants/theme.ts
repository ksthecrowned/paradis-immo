/**
 * Paradis Immo mobile tokens — aligned with Estatery / web landing
 * (@see resources/figma-design.md — landing kit link).
 */
export const colors = {
  primary: '#7065F0',
  primaryHover: '#5A50D6',
  primarySoft: '#E8E6F9',
  primaryMuted: '#F0EFFB',
  navy: '#100A55',
  ink: '#000929',
  muted: '#6C727F',
  border: '#E0DEF7',
  surface: '#FFFFFF',
  bg: '#F7F7FD',
  danger: '#DC2626',
  success: '#16A34A',
  warning: '#F5A623',
  warningSoft: '#FEF3C7',
} as const;

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
    shadowColor: '#100A55',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 3,
  },
} as const;
