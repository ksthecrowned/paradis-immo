'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { DashIcon } from '@/components/dash-icon';
import {
  DASH_ICONS,
  NAV_ROUTE_ICONS,
} from '@/lib/dash-icons';
import {
  ADMIN_NAV,
  AGENT_NAV,
  OWNER_NAV,
  isNavActive,
  type NavItem,
} from '@/lib/routes';

export type DashboardRole = 'owner' | 'agent' | 'admin';

const ROLE_NAV: Record<DashboardRole, NavItem[]> = {
  owner: OWNER_NAV,
  agent: AGENT_NAV,
  admin: ADMIN_NAV,
};

const NAV_BADGES: Partial<Record<string, string>> = {
  '/admin/dashboard': '03',
  '/agent/payments/validation': '3',
};

export interface SidebarNavProps {
  role: DashboardRole;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: SidebarNavProps): React.JSX.Element {
  const pathname = usePathname() ?? '';
  const items = ROLE_NAV[role];

  return (
    <nav
      aria-label="Navigation principale"
      className="flex h-full flex-col overflow-y-auto px-3 py-4"
    >
      {!collapsed ? (
        <p className="mb-3 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-heading/80">
          Menu
        </p>
      ) : null}
      <ul className="space-y-0.5">
        {items.map((item) => {
          const active = isNavActive(pathname, item);
          const icon = NAV_ROUTE_ICONS[item.href] ?? DASH_ICONS.dashboard;
          const badge = NAV_BADGES[item.href];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                onClick={onNavigate}
                title={collapsed ? item.label : undefined}
                aria-current={active ? 'page' : undefined}
                className={
                  'group flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ' +
                  (active
                    ? 'bg-card-hover text-active'
                    : 'text-muted hover:bg-card-hover hover:text-active')
                }
              >
                <DashIcon
                  icon={icon}
                  width={20}
                  height={20}
                  className={
                    active
                      ? 'shrink-0 text-active'
                      : 'shrink-0 text-muted group-hover:text-active'
                  }
                />
                {!collapsed ? (
                  <>
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    {badge ? (
                      <span className="inline-flex min-w-5 items-center justify-center rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-white">
                        {badge}
                      </span>
                    ) : null}
                  </>
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
