/**
 * English URL paths for dashboard routes (i18n-ready).
 * UI labels stay French in components; only path segments are English.
 */

export const ROUTES = {
  login: '/login',
  owner: {
    dashboard: '/owner/dashboard',
    properties: '/owner/properties',
    propertiesAdd: '/owner/properties/add',
    property: (id: string) => `/owner/properties/${id}`,
    visitSlots: (id: string) => `/owner/properties/${id}/visit-slots`,
    visits: '/owner/visits',
    leases: '/owner/leases',
    lease: (id: string) => `/owner/leases/${id}`,
    payments: '/owner/payments',
    maintenance: '/owner/maintenance',
    maintenanceTicket: (id: string) => `/owner/maintenance/${id}`,
    mandate: '/owner/mandate',
  },
  agent: {
    dashboard: '/agent/dashboard',
    portfolio: '/agent/portfolio',
    visits: '/agent/visits',
    leases: '/agent/leases',
    paymentsValidation: '/agent/payments/validation',
    maintenance: '/agent/maintenance',
  },
  admin: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
    moderation: '/admin/moderation',
    config: '/admin/config',
  },
} as const;

export interface NavItem {
  href: string;
  label: string;
  /** Match exact path only (e.g. dashboard root). */
  exact?: boolean;
}

export const OWNER_NAV: NavItem[] = [
  { href: ROUTES.owner.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.owner.properties, label: 'Biens' },
  { href: ROUTES.owner.visits, label: 'Visites' },
  { href: ROUTES.owner.leases, label: 'Baux' },
  { href: ROUTES.owner.payments, label: 'Paiements' },
  { href: ROUTES.owner.maintenance, label: 'Maintenance' },
  { href: ROUTES.owner.mandate, label: 'Mon mandat' },
];

export const AGENT_NAV: NavItem[] = [
  { href: ROUTES.agent.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.agent.portfolio, label: 'Portefeuille' },
  { href: ROUTES.agent.visits, label: 'Visites' },
  { href: ROUTES.agent.leases, label: 'Baux' },
  { href: ROUTES.agent.paymentsValidation, label: 'Validation paiements' },
  { href: ROUTES.agent.maintenance, label: 'Maintenance' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: ROUTES.admin.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.admin.users, label: 'Utilisateurs' },
  { href: ROUTES.admin.moderation, label: 'Modération' },
  { href: ROUTES.admin.config, label: 'Configuration' },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
