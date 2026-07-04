/**
 * Iconify icon names — Solar set (Darkone-style).
 * @see https://iconify.design/docs/icon-components/react/
 */
export const DASH_ICONS = {
  dashboard: 'solar:home-2-linear',
  buildings: 'solar:buildings-2-linear',
  calendar: 'solar:calendar-linear',
  document: 'solar:document-text-linear',
  wallet: 'solar:wallet-money-linear',
  wrench: 'solar:wrench-linear',
  mandate: 'solar:hand-shake-linear',
  users: 'solar:users-group-rounded-linear',
  shield: 'solar:shield-check-linear',
  settings: 'solar:settings-linear',
  menu: 'solar:hamburger-menu-linear',
  search: 'solar:magnifer-linear',
  sun: 'solar:sun-2-linear',
  bell: 'solar:bell-linear',
  logout: 'solar:logout-2-linear',
  close: 'solar:close-circle-linear',
} as const;

/** Bold icons for KPI stat cards — white on purple tile (Darkone). */
export const DASH_STAT_ICONS = {
  buildings: 'solar:buildings-2-bold',
  document: 'solar:document-text-bold',
  wallet: 'solar:wallet-money-bold',
  calendar: 'solar:calendar-bold',
  wrench: 'solar:wrench-bold',
  users: 'solar:users-group-rounded-bold',
  shield: 'solar:shield-check-bold',
  globe: 'solar:globe-bold',
  bag: 'solar:bag-4-bold',
  chart: 'solar:pie-chart-2-bold',
  user: 'solar:user-bold',
  bills: 'solar:bills-bold',
} as const;

/** Chart / sparkline hex colors aligned with theme tokens. */
export const DASH_CHART_COLORS = {
  purple: '#6658dd',
  green: '#22c997',
  amber: '#f5a623',
  violet: '#9b8afb',
  blue: '#5b9cf8',
} as const;

export type DashIconName = string;

/** Sidebar nav icon per route href. */
export const NAV_ROUTE_ICONS: Record<string, DashIconName> = {
  '/owner/dashboard': DASH_ICONS.dashboard,
  '/owner/properties': DASH_ICONS.buildings,
  '/owner/visits': DASH_ICONS.calendar,
  '/owner/leases': DASH_ICONS.document,
  '/owner/payments': DASH_ICONS.wallet,
  '/owner/maintenance': DASH_ICONS.wrench,
  '/owner/mandate': DASH_ICONS.mandate,
  '/agent/dashboard': DASH_ICONS.dashboard,
  '/agent/portfolio': DASH_ICONS.buildings,
  '/agent/visits': DASH_ICONS.calendar,
  '/agent/leases': DASH_ICONS.document,
  '/agent/payments/validation': DASH_ICONS.wallet,
  '/agent/maintenance': DASH_ICONS.wrench,
  '/admin/dashboard': DASH_ICONS.dashboard,
  '/admin/users': DASH_ICONS.users,
  '/admin/moderation': DASH_ICONS.shield,
  '/admin/config': DASH_ICONS.settings,
};
