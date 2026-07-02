'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Building2,
  Calendar,
  FileText,
  Handshake,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import {
  ADMIN_NAV,
  AGENT_NAV,
  OWNER_NAV,
  isNavActive,
  type NavItem,
} from '@/lib/routes';

export type DashboardRole = 'owner' | 'agent' | 'admin';

const NAV_ICONS: Record<string, LucideIcon> = {
  '/owner/dashboard': LayoutDashboard,
  '/owner/properties': Building2,
  '/owner/visits': Calendar,
  '/owner/leases': FileText,
  '/owner/payments': Wallet,
  '/owner/maintenance': Wrench,
  '/owner/mandate': Handshake,
  '/agent/dashboard': LayoutDashboard,
  '/agent/portfolio': Building2,
  '/agent/visits': Calendar,
  '/agent/leases': FileText,
  '/agent/payments/validation': Wallet,
  '/agent/maintenance': Wrench,
  '/admin/dashboard': LayoutDashboard,
  '/admin/users': Users,
  '/admin/moderation': Shield,
  '/admin/config': Settings,
};

const ROLE_NAV: Record<DashboardRole, NavItem[]> = {
  owner: OWNER_NAV,
  agent: AGENT_NAV,
  admin: ADMIN_NAV,
};

const ROLE_LABELS: Record<DashboardRole, string> = {
  owner: 'Espace propriétaire',
  agent: 'Espace agent',
  admin: 'Administration',
};

export interface SidebarNavProps {
  role: DashboardRole;
  onNavigate?: () => void;
}

export function SidebarNav({
  role,
  onNavigate,
}: SidebarNavProps): React.JSX.Element {
  const pathname = usePathname() ?? '';
  const items = ROLE_NAV[role];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-dash-border px-4 py-5">
        <p className="text-xs font-semibold uppercase tracking-wider text-dash-text-muted">
          Paradis Immo
        </p>
        <p className="mt-1 text-sm font-medium text-dash-text">
          {ROLE_LABELS[role]}
        </p>
      </div>
      <nav
        aria-label={`Navigation ${ROLE_LABELS[role]}`}
        className="flex-1 overflow-y-auto px-3 py-4"
      >
        <ul className="space-y-1">
          {items.map((item) => {
            const active = isNavActive(pathname, item);
            const Icon = NAV_ICONS[item.href] ?? LayoutDashboard;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? 'page' : undefined}
                  className={
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ' +
                    (active
                      ? 'bg-dash-accent/15 text-dash-accent'
                      : 'text-dash-text-muted hover:bg-dash-card hover:text-dash-text')
                  }
                >
                  <Icon className="size-4 shrink-0" aria-hidden />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
