'use client';

import { DashIcon } from '@/components/dash-icon';
import { invalidateAccessTokenCache } from '@/lib/api';
import { logout } from '@/lib/auth';
import { DASH_ICONS } from '@/lib/dash-icons';
import { getMe, type PublicUser } from '@/lib/me';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

export interface SidebarUserMenuProps {
  collapsed: boolean;
  onNavigate?: () => void;
}

interface MenuLinkProps {
  href: string;
  icon: string;
  label: string;
  onNavigate?: () => void;
}

function MenuLink({ href, icon, label, onNavigate }: MenuLinkProps): React.JSX.Element {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      role="menuitem"
      className="flex items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-muted transition-colors hover:bg-card-hover hover:text-active"
    >
      <DashIcon icon={icon} width={18} height={18} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function getInitials(user: { name: string | null; email: string | null }): string {
  const source = (user.name ?? user.email ?? '').trim();
  if (!source) return '?';
  const parts = source.split(/\s+|@/).filter(Boolean);
  if (parts.length === 0) return source[0]?.toUpperCase() ?? '?';
  const first = parts[0]?.[0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : '';
  return `${first}${last}`.toUpperCase();
}

function buildDisplayName(
  sessionUser: { name?: string | null; email?: string | null } | undefined,
  me: PublicUser | null,
): { name: string; email: string | null } {
  const meName = me?.name?.trim() || null;
  const meEmail = me?.email ?? null;
  const sessionName = sessionUser?.name?.trim() || null;
  const sessionEmail = sessionUser?.email ?? null;
  return {
    name: meName ?? sessionName ?? sessionEmail ?? 'Mon compte',
    email: meEmail ?? sessionEmail ?? null,
  };
}

export function SidebarUserMenu({
  collapsed,
  onNavigate,
}: SidebarUserMenuProps): React.JSX.Element {
  const { data: session } = useSession();
  const [me, setMe] = useState<PublicUser | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const user = await getMe();
        if (!cancelled) setMe(user);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handlePointer(event: MouseEvent): void {
      const root = wrapperRef.current;
      if (root && !root.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    function handleKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    }
    document.addEventListener('mousedown', handlePointer);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      document.removeEventListener('keydown', handleKey);
    };
  }, [menuOpen]);

  function handleLogout(): void {
    setMenuOpen(false);
    onNavigate?.();
    invalidateAccessTokenCache();
    void logout('/login');
  }

  const { name, email } = buildDisplayName(session?.user, me);
  const initials = getInitials({ name, email });
  const avatarUrl = me?.avatarUrl ?? session?.user?.image ?? null;

  const triggerLabel = menuOpen ? 'Fermer le menu profil' : 'Ouvrir le menu profil';

  // Mode collapsed : popover flottant à droite (aligné en bas).
  // Mode expanded : dropdown inline en dessous du trigger.
  return (
    <div
      ref={wrapperRef}
      className={
        'relative border-t border-border ' + (collapsed ? 'px-2 py-3' : 'px-3 py-3')
      }
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        aria-label={triggerLabel}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className={
          'flex w-full items-center gap-3 rounded-lg transition-colors hover:bg-card-hover ' +
          (collapsed ? 'justify-center p-1.5' : 'p-2')
        }
      >
        <span
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full text-sm font-semibold text-white shadow-sm"
          style={{
            background:
              'conic-gradient(from 210deg, #6658dd 0deg, #22c997 90deg, #f5a623 180deg, #ef4444 270deg, #6658dd 360deg)',
          }}
          aria-hidden
        >
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt=""
              className="size-full object-cover"
            />
          ) : (
            <span className="text-white/90">{initials}</span>
          )}
        </span>
        {!collapsed ? (
          <>
            <span className="min-w-0 flex-1 text-start">
              <span className="block truncate text-base font-semibold text-foreground">
                {name}
              </span>
              {email ? (
                <span className="block truncate text-xs text-muted">{email}</span>
              ) : null}
            </span>
            <DashIcon
              icon={menuOpen ? DASH_ICONS.chevronUp : DASH_ICONS.chevronDown}
              width={16}
              height={16}
              className="shrink-0 text-muted"
            />
          </>
        ) : null}
      </button>

      {menuOpen && collapsed ? (
        // Popover flottant à droite (mode collapsed)
        <div
          role="menu"
          className="absolute bottom-0 start-full ms-2 z-50 min-w-[240px] rounded-xl border border-border bg-sidebar p-2 shadow-xl"
        >
          <UserMenuItems
            name={name}
            email={email}
            onClose={() => setMenuOpen(false)}
            onAction={onNavigate}
            onLogout={handleLogout}
          />
        </div>
      ) : null}

      {menuOpen && !collapsed ? (
        // Dropdown inline en dessous (mode expanded)
        <div
          role="menu"
          className="absolute bottom-full start-0 end-0 mb-2 z-50 rounded-xl border border-border bg-sidebar p-2 shadow-xl"
        >
          <UserMenuItems
            name={name}
            email={email}
            onClose={() => setMenuOpen(false)}
            onAction={onNavigate}
            onLogout={handleLogout}
          />
        </div>
      ) : null}
    </div>
  );
}

interface UserMenuItemsProps {
  name: string;
  email: string | null;
  onClose: () => void;
  onAction?: () => void;
  onLogout: () => void;
}

function UserMenuItems({
  name,
  email,
  onClose,
  onAction,
  onLogout,
}: UserMenuItemsProps): React.JSX.Element {
  return (
    <>
      <div className="px-3 py-2">
        <p className="truncate text-base font-semibold text-foreground">{name}</p>
        {email ? (
          <p className="truncate text-xs text-muted">{email}</p>
        ) : null}
      </div>
      <div className="my-1 border-t border-border" />
      <div className="flex flex-col gap-0.5">
        <MenuLink
          href="/profile"
          icon={DASH_ICONS.user}
          label="Mon profil"
          onNavigate={() => {
            onClose();
            onAction?.();
          }}
        />
        <MenuLink
          href="/settings"
          icon={DASH_ICONS.settings}
          label="Paramètres"
          onNavigate={() => {
            onClose();
            onAction?.();
          }}
        />
        <button
          type="button"
          role="menuitem"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-base font-medium text-muted transition-colors hover:bg-card-hover hover:text-active"
        >
          <DashIcon
            icon={DASH_ICONS.logout}
            width={18}
            height={18}
            className="shrink-0"
          />
          <span className="truncate">Déconnexion</span>
        </button>
      </div>
    </>
  );
}
