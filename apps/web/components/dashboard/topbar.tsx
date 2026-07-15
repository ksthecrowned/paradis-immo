'use client';

import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { DASH_ICONS } from '@/lib/dash-icons';
import { RoleSwitcher } from './role-switcher';

export interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();

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

      <label className="hidden min-w-0 flex-1 max-w-md sm:block">
        <span className="sr-only">Rechercher</span>
        <span className="relative flex items-center">
          <DashIcon
            icon={DASH_ICONS.search}
            width={18}
            height={18}
            className="pointer-events-none absolute start-3 text-muted"
          />
          <input
            type="search"
            placeholder="Rechercher…"
            className="w-full rounded-full border border-transparent bg-search py-2.5 ps-10 pe-4 text-base text-foreground placeholder:text-placeholder focus:border-input-border focus:outline-none focus:ring-2 focus:ring-accent/30"
          />
        </span>
      </label>

      <div className="ms-auto flex shrink-0 items-center gap-2">
        <RoleSwitcher />
        <button
          type="button"
          className="relative inline-flex size-11 items-center justify-center rounded-full bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
          aria-label="Notifications"
          title="Notifications"
        >
          <DashIcon icon={DASH_ICONS.bell} width={22} height={22} />
          <span
            aria-hidden
            className="absolute end-2 top-2 inline-flex min-w-[18px] h-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold leading-none text-white shadow-sm ring-2 ring-topbar"
          >
            3
          </span>
        </button>
        <button
          type="button"
          className="inline-flex size-11 items-center justify-center rounded-full bg-card text-muted transition-colors hover:bg-card-hover hover:text-active"
          aria-label={
            theme === 'dark' ? 'Passer en mode clair' : 'Passer en mode sombre'
          }
          title={theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
          onClick={toggleTheme}
        >
          <DashIcon
            icon={theme === 'dark' ? DASH_ICONS.sun : DASH_ICONS.moon}
            width={22}
            height={22}
          />
        </button>
      </div>
    </div>
  );
}
