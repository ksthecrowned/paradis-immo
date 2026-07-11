'use client';

import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { logout } from '@/lib/auth';
import { DASH_ICONS } from '@/lib/dash-icons';
import { RoleSwitcher } from './role-switcher';

export interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();

  function handleLogout(): void {
    void logout('/login');
  }

  return (
    <div className="flex min-w-0 flex-1 items-center gap-3 px-4 lg:px-5 border-b border-border">
      <button
        type="button"
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
        aria-label="Menu"
        onClick={onMenuClick}
      >
        <DashIcon icon={DASH_ICONS.menu} width={22} height={22} />
      </button>

      <div className="relative hidden min-w-0 flex-1 sm:block sm:max-w-xl">
        <DashIcon
          icon={DASH_ICONS.search}
          width={16}
          height={16}
          className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="search"
          placeholder="Biens, locataires, paiements…"
          className="block w-full max-w-md rounded-full border-none bg-search py-2.5 ps-11 pe-4 text-[13px] text-foreground placeholder:text-muted focus:ring-0"
        />
      </div>

      <div className="ms-auto flex shrink-0 items-center gap-2">
        <RoleSwitcher />
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
          aria-label={theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'}
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          onClick={toggleTheme}
        >
          <DashIcon
            icon={theme === 'dark' ? DASH_ICONS.sun : DASH_ICONS.moon}
            width={22}
            height={22}
          />
        </button>

        <button
          type="button"
          className="relative inline-flex size-11 items-center justify-center rounded-full bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
          aria-label="Notifications"
        >
          <DashIcon icon={DASH_ICONS.bell} width={22} height={22} />
          <span className="absolute -inset-e-0.5 -top-0.5 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[12px] font-bold leading-none text-white">
            5
          </span>
        </button>

        <div className="hs-dropdown relative inline-flex">
          <button
            id="topbar-user-menu"
            type="button"
            className="inline-flex size-11 items-center justify-center overflow-hidden rounded-full bg-card"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-label="Menu utilisateur"
            data-hs-dropdown-toggle
          >
            <span className="text-[13px] font-bold text-active">PI</span>
          </button>

          <div
            className="hs-dropdown-menu duration z-50 mt-2 hidden min-w-44 rounded-xl border border-border bg-card p-1 shadow-xl opacity-0 transition-[opacity,margin] hs-dropdown-open:opacity-100"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="topbar-user-menu"
          >
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition-colors hover:bg-card-hover"
              role="menuitem"
            >
              <DashIcon
                icon={DASH_ICONS.logout}
                width={16}
                height={16}
                className="text-muted"
              />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
