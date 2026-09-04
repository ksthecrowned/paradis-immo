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
    visitSlotsIndex: '/owner/visit-slots',
    leases: '/owner/leases',
    leasesAdd: '/owner/leases/add',
    lease: (id: string) => `/owner/leases/${id}`,
    leaseEdit: (id: string) => `/owner/leases/${id}/edit`,
    tenants: '/owner/tenants',
    tenant: (id: string) => `/owner/tenants/${id}`,
    payments: '/owner/payments',
    payment: (id: string) => `/owner/payments/${id}`,
    maintenance: '/owner/maintenance',
    maintenanceAdd: '/owner/maintenance/add',
    maintenanceTicket: (id: string) => `/owner/maintenance/${id}`,
    maintenanceEdit: (id: string) => `/owner/maintenance/${id}/edit`,
    mandate: '/owner/mandate',
    mandateAdd: '/owner/mandate/add',
    bookings: '/owner/bookings',
    sales: '/owner/sales',
    salesAdd: '/owner/sales/add',
    sale: (id: string) => `/owner/sales/${id}`,
  },
  agent: {
    dashboard: '/agent/dashboard',
    portfolio: '/agent/portfolio',
    portfolioAdd: '/agent/portfolio/add',
    property: (id: string) => `/agent/portfolio/${id}`,
    propertyEdit: (id: string) => `/agent/portfolio/${id}/edit`,
    visitSlots: (id: string) => `/agent/portfolio/${id}/visit-slots`,
    visits: '/agent/visits',
    leases: '/agent/leases',
    leasesAdd: '/agent/leases/add',
    lease: (id: string) => `/agent/leases/${id}`,
    leaseEdit: (id: string) => `/agent/leases/${id}/edit`,
    tenants: '/agent/tenants',
    tenant: (id: string) => `/agent/tenants/${id}`,
    paymentsValidation: '/agent/payments/validation',
    payment: (id: string) => `/agent/payments/${id}`,
    maintenance: '/agent/maintenance',
    maintenanceAdd: '/agent/maintenance/add',
    maintenanceTicket: (id: string) => `/agent/maintenance/${id}`,
    maintenanceEdit: (id: string) => `/agent/maintenance/${id}/edit`,
    sales: '/agent/sales',
    salesAgreements: '/agent/sales/agreements',
    salesAgreementsAdd: '/agent/sales/agreements/add',
    saleAgreement: (id: string) => `/agent/sales/agreements/${id}`,
    bookings: '/agent/bookings',
  },
  admin: {
    dashboard: '/admin/dashboard',
    users: '/admin/users',
    moderation: '/admin/moderation',
    reports: '/admin/reports',
    config: '/admin/config',
  },
} as const;

export interface NavItem {
  href: string;
  label: string;
  /** Match exact path only (e.g. dashboard root). */
  exact?: boolean;
  /**
   * When `true`, child routes also count as active matches for the parent
   * (default behaviour). Set to `false` to make the parent highlight only
   * on its own path — useful when children are siblings rather than nested
   * pages of the parent.
   */
  activeOnChildren?: boolean;
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
  { href: ROUTES.owner.mandate, label: 'Mandats' },
  { href: ROUTES.owner.maintenance, label: 'Maintenance' },
  { href: ROUTES.owner.bookings, label: 'Réservations' },
  { href: ROUTES.owner.leases, label: 'Baux' },
  { href: ROUTES.owner.tenants, label: 'Locataires' },
  { href: ROUTES.owner.sales, label: 'Dossiers de vente' },
  { href: ROUTES.owner.visits, label: 'Visites' },
  { href: ROUTES.owner.payments, label: 'Paiements' },
];

export const AGENT_NAV: NavItem[] = [
  { href: ROUTES.agent.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.agent.portfolio, label: 'Biens' },
  { href: ROUTES.agent.maintenance, label: 'Maintenance' },
  { href: ROUTES.agent.bookings, label: 'Réservations' },
  { href: ROUTES.agent.leases, label: 'Baux' },
  { href: ROUTES.agent.tenants, label: 'Locataires' },
  {
    href: ROUTES.agent.sales,
    label: 'Vente',
    children: [
      { href: ROUTES.agent.sales, label: 'Demandes', exact: true },
      { href: ROUTES.agent.salesAgreements, label: 'Dossiers' },
    ],
  },
  { href: ROUTES.agent.visits, label: 'Visites' },
  { href: ROUTES.agent.paymentsValidation, label: 'Paiements' },
];

export const ADMIN_NAV: NavItem[] = [
  { href: ROUTES.admin.dashboard, label: 'Tableau de bord', exact: true },
  { href: ROUTES.admin.users, label: 'Utilisateurs' },
  { href: ROUTES.admin.moderation, label: 'Modération' },
  { href: ROUTES.admin.reports, label: 'Signalements' },
  { href: ROUTES.admin.config, label: 'Configuration' },
];

/** Grouped sidebar nav per role. */
export const OWNER_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Vue d’ensemble',
    items: [
      { href: ROUTES.owner.dashboard, label: 'Tableau de bord', exact: true },
    ],
  },
  {
    label: 'Patrimoine',
    items: [
      { href: ROUTES.owner.properties, label: 'Biens' },
      { href: ROUTES.owner.mandate, label: 'Mandats' },
      { href: ROUTES.owner.maintenance, label: 'Maintenance' },
    ],
  },
  {
    label: 'Location & Vente',
    items: [
      { href: ROUTES.owner.bookings, label: 'Réservations' },
      { href: ROUTES.owner.leases, label: 'Baux' },
      { href: ROUTES.owner.tenants, label: 'Locataires' },
      { href: ROUTES.owner.sales, label: 'Dossiers de vente' },
    ],
  },
  {
    label: 'Activité & Finance',
    items: [
      { href: ROUTES.owner.visits, label: 'Visites' },
      { href: ROUTES.owner.payments, label: 'Paiements' },
    ],
  },
];

export const AGENT_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Vue d’ensemble',
    items: [
      { href: ROUTES.agent.dashboard, label: 'Tableau de bord', exact: true },
    ],
  },
  {
    label: 'Patrimoine',
    items: [
      { href: ROUTES.agent.portfolio, label: 'Biens' },
      { href: ROUTES.agent.maintenance, label: 'Maintenance' },
    ],
  },
  {
    label: 'Location & Vente',
    items: [
      { href: ROUTES.agent.bookings, label: 'Réservations' },
      { href: ROUTES.agent.leases, label: 'Baux' },
      { href: ROUTES.agent.tenants, label: 'Locataires' },
      {
        href: ROUTES.agent.sales,
        label: 'Vente',
        children: [
          { href: ROUTES.agent.sales, label: 'Demandes', exact: true },
          { href: ROUTES.agent.salesAgreements, label: 'Dossiers' },
        ],
      },
    ],
  },
  {
    label: 'Activité & Finance',
    items: [
      { href: ROUTES.agent.visits, label: 'Visites' },
      { href: ROUTES.agent.paymentsValidation, label: 'Paiements' },
    ],
  },
];

export const ADMIN_NAV_GROUPS: NavGroup[] = [
  {
    label: 'Général',
    items: [
      { href: ROUTES.admin.dashboard, label: 'Tableau de bord', exact: true },
      { href: ROUTES.admin.moderation, label: 'Modération' },
      { href: ROUTES.admin.reports, label: 'Signalements' },
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
  // Default: a parent is also active when a child matches (good for nested
  // sub-pages). Set `activeOnChildren: false` to opt out (siblings case).
  if (item.activeOnChildren !== false && item.children?.length) {
    return item.children.some((child) => isNavActive(pathname, child));
  }
  return false;
}

const BREADCRUMB_LABELS: Record<string, string> = {
  dashboard: 'Tableau de bord',
  properties: 'Biens',
  add: 'Ajouter',
  edit: 'Modifier',
  'visit-slots': 'Créneaux de visite',
  visits: 'Visites',
  leases: 'Baux',
  tenants: 'Locataires',
  payments: 'Paiements',
  validation: 'Validation paiements',
  maintenance: 'Maintenance',
  mandate: 'Mandats',
  portfolio: 'Biens',
  sales: 'Vente',
  agreements: 'Dossiers',
  bookings: 'Réservations',
  users: 'Utilisateurs',
  moderation: 'Modération',
  reports: 'Signalements',
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
