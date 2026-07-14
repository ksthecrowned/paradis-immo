'use client';

import { DashIcon } from '@/components/dash-icon';
import { useTheme } from '@/components/theme-provider';
import { invalidateAccessTokenCache } from '@/lib/api';
import { logout } from '@/lib/auth';
import { DASH_ICONS } from '@/lib/dash-icons';
import { RoleSwitcher } from './role-switcher';

export interface TopbarProps {
  onMenuClick?: () => void;
}

export function Topbar({ onMenuClick }: TopbarProps): React.JSX.Element {
  const { theme, toggleTheme } = useTheme();

  function handleLogout(): void {
    invalidateAccessTokenCache();
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

      <div className="ms-auto flex shrink-0 items-center gap-2">
        <RoleSwitcher />
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

        <button
          type="button"
          onClick={handleLogout}
          className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-2.5 text-base font-medium text-foreground transition-colors hover:bg-card-hover hover:text-active"
          aria-label="Se déconnecter"
          title="Se déconnecter"
        >
          <DashIcon
            icon={DASH_ICONS.logout}
            width={18}
            height={18}
            className="text-muted"
          />
          <span className="hidden sm:inline">Déconnexion</span>
        </button>
      </div>
    </div>
  );
}
