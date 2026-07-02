'use client';

import { Bell, ChevronDown, LogOut, User } from 'lucide-react';
import { logout } from '@/lib/auth';

export interface TopbarProps {
  title?: string;
}

export function Topbar({ title }: TopbarProps): React.JSX.Element {
  function handleLogout(): void {
    logout();
    window.location.href = '/login';
  }

  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-dash-border bg-dash-sidebar px-4 lg:px-6">
      <div className="min-w-0">
        {title ? (
          <p className="truncate text-sm font-medium text-dash-text-muted lg:hidden">
            {title}
          </p>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          className="relative inline-flex size-9 items-center justify-center rounded-lg text-dash-text-muted transition-colors hover:bg-dash-card hover:text-dash-text"
          aria-label="Notifications"
        >
          <Bell className="size-5" />
          <span className="absolute end-1.5 top-1.5 size-2 rounded-full bg-dash-danger" />
        </button>

        <div className="hs-dropdown relative inline-flex">
          <button
            id="topbar-user-menu"
            type="button"
            className="inline-flex items-center gap-2 rounded-lg border border-dash-border bg-dash-card px-3 py-1.5 text-sm font-medium text-dash-text transition-colors hover:border-dash-accent/40"
            aria-haspopup="menu"
            aria-expanded="false"
            aria-label="Menu utilisateur"
            data-hs-dropdown-toggle
          >
            <span className="flex size-7 items-center justify-center rounded-full bg-dash-accent/20 text-dash-accent">
              <User className="size-4" aria-hidden />
            </span>
            <span className="hidden sm:inline">Mon compte</span>
            <ChevronDown className="size-4 text-dash-text-muted" aria-hidden />
          </button>

          <div
            className="hs-dropdown-menu duration z-50 mt-2 hidden min-w-48 rounded-xl border border-dash-border bg-dash-card p-1 shadow-lg opacity-0 transition-[opacity,margin] hs-dropdown-open:opacity-100"
            role="menu"
            aria-orientation="vertical"
            aria-labelledby="topbar-user-menu"
          >
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-dash-text transition-colors hover:bg-dash-sidebar"
              role="menuitem"
            >
              <LogOut className="size-4 text-dash-text-muted" aria-hidden />
              Se déconnecter
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
