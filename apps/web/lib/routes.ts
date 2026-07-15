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
    propertyEdit: (id: string) => `/owner/properties/${id}/edit`,
    visitSlots: (id: string) => `/owner/properties/${id}/visit-slots`,
    visits: '/owner/visits',
    leases: '/owner/leases',
    leasesAdd: '/owner/leases/add',
    lease: (id: string) => `/owner/leases/${id}`,
    payments: '/owner/payments',
    payment: (id: string) => `/owner/payments/${id}`,
    maintenance: '/owner/maintenance',
    maintenanceTicket: (id: string) => `/owner/maintenance/${id}`,
    mandate: '/owner/mandate',
    bookings: '/owner/bookings',
  },
  agent: {
    dashboard: '/agent/dashboard',
    portfolio: '/agent/portfolio',
    visits: '/agent/visits',
    leases: '/agent/leases',
    paymentsValidation: '/agent/payments/validation',
    messaging: '/agent/messaging',
    maintenance: '/agent/maintenance',
    sales: '/agent/sales',
    bookings: '/agent/bookings',
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
  /** Optional sub-items shown as a dropdown. */
  children?: NavItem[];
}

export interface NavGroup {
  /** Section label shown above the items. */
  label: string;
  items: NavItem[];
}

export const OWNER_NAV: NavItem[] = [
  { href: ROUTES.owner.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.owner.properties, label: 'Biens' },
  { href: ROUTES.owner.bookings, label: 'Réservations' },
  { href: ROUTES.owner.visits, label: 'Visites' },
  { href: ROUTES.owner.leases, label: 'Baux' },
  { href: ROUTES.owner.payments, label: 'Paiements' },
  { href: ROUTES.owner.maintenance, label: 'Maintenance' },
  { href: ROUTES.owner.mandate, label: 'Mon mandat' },
];

export const AGENT_NAV: NavItem[] = [
  { href: ROUTES.agent.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.agent.portfolio, label: 'Portefeuille' },
  { href: ROUTES.agent.bookings, label: 'Réservations' },
  { href: ROUTES.agent.visits, label: 'Visites' },
  { href: ROUTES.agent.leases, label: 'Baux' },
  { href: ROUTES.agent.sales, label: 'Demandes vente' },
  { href: ROUTES.agent.paymentsValidation, label: 'Validation paiements' },
  { href: ROUTES.agent.messaging, label: 'Messaging SMS' },
  { href: ROUTES.agent.maintenance, label: 'Maintenance' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: ROUTES.admin.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.admin.users, label: 'Utilisateurs' },
  { href: ROUTES.admin.moderation, label: 'Modération' },
  { href: ROUTES.admin.config, label: 'Configuration' },
];

/** Grouped sidebar nav per role — Activité / Patrimoine / Compte. */
export const OWNER_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Activité',
    items: [
      { href: ROUTES.owner.dashboard, label: 'Tableau de bord', exact: true },
      { href: ROUTES.owner.bookings, label: 'Réservations' },
      { href: ROUTES.owner.visits, label: 'Visites' },
      {
        href: ROUTES.owner.leases,
        label: 'Baux',
        children: [
          { href: ROUTES.owner.leases, label: 'Mes baux' },
          { href: ROUTES.owner.leasesAdd, label: 'Ajouter un bail' },
        ],
      },
      { href: ROUTES.owner.payments, label: 'Paiements' },
    ],
  },
  {
    label: 'Patrimoine',
    items: [
      {
        href: ROUTES.owner.properties,
        label: 'Biens',
        children: [
          { href: ROUTES.owner.properties, label: 'Mes biens' },
          { href: ROUTES.owner.propertiesAdd, label: 'Ajouter un bien' },
        ],
      },
      { href: ROUTES.owner.maintenance, label: 'Maintenance' },
      { href: ROUTES.owner.mandate, label: 'Mon mandat' },
    ],
  },
];

export const AGENT_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Activité',
    items: [
      { href: ROUTES.agent.dashboard, label: 'Tableau de bord', exact: true },
      { href: ROUTES.agent.bookings, label: 'Réservations' },
      { href: ROUTES.agent.visits, label: 'Visites' },
      { href: ROUTES.agent.leases, label: 'Baux' },
      { href: ROUTES.agent.sales, label: 'Demandes vente' },
      { href: ROUTES.agent.paymentsValidation, label: 'Validation paiements' },
      { href: ROUTES.agent.messaging, label: 'Messaging SMS' },
    ],
  },
  {
    label: 'Patrimoine',
    items: [
      {
        href: ROUTES.agent.portfolio,
        label: 'Portefeuille',
        children: [
          { href: ROUTES.agent.portfolio, label: 'Mes biens' },
          { href: ROUTES.agent.sales, label: 'Demandes de vente' },
        ],
      },
      { href: ROUTES.agent.maintenance, label: 'Maintenance' },
    ],
  },
];

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Activité',
    items: [
      { href: ROUTES.admin.dashboard, label: 'Tableau de bord', exact: true },
      { href: ROUTES.admin.moderation, label: 'Modération' },
    ],
  },
  {
    label: 'Compte',
    items: [
      { href: ROUTES.admin.users, label: 'Utilisateurs' },
      { href: ROUTES.admin.config, label: 'Configuration' },
    ],
  },
];

export function isNavActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  if (pathname === item.href || pathname.startsWith(`${item.href}/`)) return true;
  if (item.children?.length) {
    return item.children.some((child) => isNavActive(pathname, child));
  }
  return false;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  properties: 'Biens',
  add: 'Ajouter',
  'visit-slots': 'Créneaux de visite',
  visits: 'Visites',
  leases: 'Baux',
  payments: 'Paiements',
  validation: 'Validation paiements',
  messaging: 'Messaging SMS',
  maintenance: 'Maintenance',
  mandate: 'Mon mandat',
  portfolio: 'Portefeuille',
  sales: 'Demandes vente',
  bookings: 'Réservations',
  users: 'Utilisateurs',
  moderation: 'Modération',
  config: 'Configuration',
};

export function breadcrumbForPath(pathname: string): { label: string; href?: string }[] {
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length === 0) return [];
  const role = segments[0];
  const roleHome = `/${role}/dashboard`;
  const items: { label: string; href?: string }[] = [
    { label: 'Paradis Immo', href: roleHome },
  ];
  let path = '';
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    path += `/${seg}`;
    const label = BREADCRUMB_LABELS[seg];
    if (!label) continue;
    const isLast = i === segments.length - 1;
    items.push(isLast ? { label } : { label, href: path });
  }
  return items;
}
