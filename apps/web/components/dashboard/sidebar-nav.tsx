'use client';

import { DashIcon } from '@/components/dash-icon';
import { DASH_ICONS, NAV_ROUTE_ICONS } from '@/lib/dash-icons';
import {
  ADMIN_NAV_GROUPS,
  AGENT_NAV_GROUPS,
  OWNER_NAV_GROUPS,
  isNavActive,
  type NavGroup,
  type NavItem,
} from '@/lib/routes';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { SidebarUserMenu } from './sidebar-user-menu';

export type DashboardRole = 'owner' | 'agent' | 'admin';

const ROLE_NAV: Record<DashboardRole, NavGroup[]> = {
  owner: OWNER_NAV_GROUPS,
  agent: AGENT_NAV_GROUPS,
  admin: ADMIN_NAV_GROUPS,
};

export interface SidebarNavProps {
  role: DashboardRole;
  collapsed?: boolean;
  onNavigate?: () => void;
}

function hasActiveChild(item: NavItem, pathname: string): boolean {
  return item.children?.some((c) => isNavActive(pathname, c)) ?? false;
}

interface ChildRowProps {
  child: NavItem;
  pathname: string;
  depth: number;
  onNavigate?: () => void;
}

function ChildRow({
  child,
  pathname,
  depth,
  onNavigate,
}: ChildRowProps): React.JSX.Element {
  const active = isNavActive(pathname, child);
  return (
    <li>
      <Link
        href={child.href}
        onClick={onNavigate}
        aria-current={active ? 'page' : undefined}
        className={
          'group flex items-center gap-3 rounded-lg py-2 text-base font-medium transition-colors ' +
          (active
            ? 'text-active'
            : 'text-muted hover:bg-card-hover hover:text-active')
        }
        style={{ paddingInlineStart: `${depth * 0.75 + 0.75}rem` }}
      >
        <span
          aria-hidden
          className={
            'size-1.5 shrink-0 rounded-full ' +
            (active ? 'bg-active' : 'bg-muted/40 group-hover:bg-muted')
          }
        />
        <span className="min-w-0 flex-1 truncate">{child.label}</span>
      </Link>
    </li>
  );
}

interface NavItemRowProps {
  item: NavItem;
  pathname: string;
  collapsed: boolean;
  depth: number;
  onNavigate?: () => void;
  /**
   * When true, force-open the submenu (used on mount when a child is active).
   */
  forceOpen?: boolean;
  onChildActiveChange?: (active: boolean) => void;
}

function NavItemRow({
  item,
  pathname,
  collapsed,
  depth,
  onNavigate,
  forceOpen = false,
  onChildActiveChange,
}: NavItemRowProps): React.JSX.Element {
  const hasChildren = (item.children?.length ?? 0) > 0;
  const childActive = hasActiveChild(item, pathname);
  const [open, setOpen] = useState<boolean>(forceOpen || childActive);

  // Notifier le parent pour qu'il puisse mettre en valeur l'item parent.
  useEffect(() => {
    onChildActiveChange?.(childActive);
  }, [childActive, onChildActiveChange]);

  // Auto-open quand un enfant devient actif.
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  // Si forceOpen change (au mount), ouvrir.
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const active = isNavActive(pathname, item);
  const icon = NAV_ROUTE_ICONS[item.href] ?? DASH_ICONS.dashboard;
  const wrapperRef = useRef<HTMLDivElement | null>(null);

  // Fermer au clic extérieur en mode collapsed.
  useEffect(() => {
    if (!collapsed || !hasChildren || !open) return;
    function handlePointer(event: MouseEvent): void {
      const root = wrapperRef.current;
      if (root && !root.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [collapsed, hasChildren, open]);

  function handleParentClick(event: React.MouseEvent<HTMLAnchorElement>): void {
    if (!hasChildren) {
      onNavigate?.();
      return;
    }
    // En mode expanded : naviguer vers la page parente + ouvrir le sous-menu.
    if (!collapsed) {
      onNavigate?.();
      setOpen(true);
      return;
    }
    // En mode collapsed : empêcher la navigation, ouvrir le popover.
    event.preventDefault();
    setOpen((v) => !v);
  }

  // ── Rendu d'un sous-menu en popover flottant (collapsed)
  const popover = hasChildren && open && collapsed ? (
    <div
      role="menu"
      className="absolute start-full ms-2 top-0 z-50 min-w-[200px] rounded-xl border border-border bg-sidebar p-2 shadow-xl"
    >
      <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-heading/70">
        {item.label}
      </div>
      <ul className="flex flex-col gap-0.5">
        {item.children!.map((child) => (
          <li key={child.href + child.label}>
            <Link
              href={child.href}
              role="menuitem"
              onClick={onNavigate}
              aria-current={isNavActive(pathname, child) ? 'page' : undefined}
              className={
                'flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium transition-colors ' +
                (isNavActive(pathname, child)
                  ? 'bg-card-hover text-active'
                  : 'text-muted hover:bg-card-hover hover:text-active')
              }
            >
              <span
                aria-hidden
                className={
                  'size-1.5 shrink-0 rounded-full ' +
                  (isNavActive(pathname, child)
                    ? 'bg-active'
                    : 'bg-muted/40')
                }
              />
              <span className="truncate">{child.label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  return (
    <div ref={wrapperRef} className="relative">
      <div
        className={
          'group flex items-center gap-1 rounded-lg transition-colors ' +
          (active
            ? 'bg-card-hover text-active'
            : 'text-muted hover:bg-card-hover hover:text-active')
        }
      >
        <Link
          href={item.href}
          onClick={handleParentClick}
          title={collapsed ? item.label : undefined}
          aria-current={active ? 'page' : undefined}
          className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 text-base"
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
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
          ) : null}
        </Link>
        {!collapsed && hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setOpen((v) => !v);
            }}
            aria-label={open ? 'Fermer le sous-menu' : 'Ouvrir le sous-menu'}
            className="flex size-9 shrink-0 items-center justify-center rounded-md text-muted hover:text-active"
            tabIndex={-1}
          >
            <DashIcon
              icon={DASH_ICONS.chevronDown}
              width={14}
              height={14}
              className={'transition-transform ' + (open ? 'rotate-180' : '')}
            />
          </button>
        ) : null}
      </div>

      {/* Sous-menu inline (mode expanded) */}
      {!collapsed && hasChildren && open ? (
        <ul className="mt-0.5 flex flex-col gap-0.5">
          {item.children!.map((child) => (
            <ChildRow
              key={child.href + child.label}
              child={child}
              pathname={pathname}
              depth={depth + 1}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      ) : null}

      {/* Sous-menu popover (mode collapsed) */}
      {popover}
    </div>
  );
}

export function SidebarNav({
  role,
  collapsed = false,
  onNavigate,
}: SidebarNavProps): React.JSX.Element {
  const pathname = usePathname() ?? '';
  const groups = ROLE_NAV[role];

  return (
    <nav
      aria-label="Navigation principale"
      className="flex h-full flex-col"
    >
      <div className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => {
          if (group.items.length === 0) return null;
          return (
            <div key={group.label} className="mb-5 last:mb-0">
              {!collapsed ? (
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-heading/70">
                  {group.label}
                </p>
              ) : null}
              <ul className="space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href + item.label}>
                    <NavItemRow
                      item={item}
                      pathname={pathname}
                      collapsed={collapsed}
                      depth={0}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <SidebarUserMenu collapsed={collapsed} onNavigate={onNavigate} />
    </nav>
  );
}
