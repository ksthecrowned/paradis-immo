'use client';

import { DashIcon } from '@/components/dash-icon';
import { DASH_ICONS, NAV_ROUTE_ICONS } from '@/lib/dash-icons';
import {
  ADMIN_NAV_GROUPS,
  AGENT_NAV_GROUPS,
  OWNER_NAV_GROUPS,
  type NavGroup,
  type NavItem,
} from '@/lib/routes';
import { Command } from 'cmdk';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { DashboardRole } from './sidebar-nav';

interface SearchItem {
  id: string;
  title: string;
  parentTitle?: string;
  section: string;
  url: string;
  icon: string;
}

const ROLE_NAV: Record<DashboardRole, NavGroup[]> = {
  owner: OWNER_NAV_GROUPS,
  agent: AGENT_NAV_GROUPS,
  admin: ADMIN_NAV_GROUPS,
};

function collectItems(
  groups: NavGroup[],
): Record<string, SearchItem[]> {
  const sectionsMap: Record<string, SearchItem[]> = {};

  function pushItem(
    sectionLabel: string,
    item: NavItem,
    parentTitle?: string,
  ): void {
    if (!sectionsMap[sectionLabel]) {
      sectionsMap[sectionLabel] = [];
    }
    sectionsMap[sectionLabel].push({
      id: item.href + (parentTitle ? `:${item.label}` : ''),
      title: item.label,
      parentTitle,
      section: sectionLabel,
      url: item.href,
      icon: NAV_ROUTE_ICONS[item.href] ?? DASH_ICONS.dashboard,
    });
  }

  for (const section of groups) {
    const sectionLabel = section.label || 'Pages';
    for (const item of section.items) {
      if (item.children?.length) {
        for (const child of item.children) {
          pushItem(sectionLabel, child, item.label);
        }
      } else {
        pushItem(sectionLabel, item);
      }
    }
  }

  return sectionsMap;
}

export interface GlobalSearchProps {
  role: DashboardRole;
}

export function GlobalSearch({ role }: GlobalSearchProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent): void {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const itemsBySection = useMemo(
    () => collectItems(ROLE_NAV[role]),
    [role],
  );

  function handleSelect(url: string): void {
    setOpen(false);
    router.push(url);
  }

  return (
    <div className="min-w-0 flex-1 max-w-md">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex size-11 items-center justify-center rounded-full bg-card text-muted transition-colors hover:bg-card-hover hover:text-active sm:hidden"
        aria-label="Ouvrir la recherche"
      >
        <DashIcon icon={DASH_ICONS.search} width={20} height={20} />
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="hidden w-full text-left outline-none focus:outline-none sm:block"
      >
        <span className="relative flex h-11 items-center rounded-full border border-transparent bg-search px-1 transition-colors hover:border-input-border">
          <span className="pointer-events-none absolute inset-s-3 text-muted">
            <DashIcon icon={DASH_ICONS.search} width={18} height={18} />
          </span>
          <span className="w-full truncate py-2.5 ps-10 pe-16 text-base text-placeholder select-none">
            Rechercher une page…
          </span>
          <span className="absolute inset-e-2.5 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted">
            <span className="font-medium">⌘</span> K
          </span>
        </span>
      </button>

      <Command.Dialog
        open={open}
        onOpenChange={setOpen}
        label="Recherche globale"
        overlayClassName="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] transition-opacity duration-200"
        contentClassName="fixed top-1/2 left-1/2 z-50 w-full max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-border bg-card text-foreground shadow-2xl outline-none max-sm:max-w-[calc(100%-2rem)]"
      >
        <div className="border-b border-border p-3.5">
          <div className="relative flex h-10 items-center rounded-lg border border-input-border bg-search px-1">
            <span className="pointer-events-none absolute inset-s-3 text-muted">
              <DashIcon icon={DASH_ICONS.search} width={18} height={18} />
            </span>
            <Command.Input
              placeholder="Rechercher une page…"
              className="w-full min-w-0 flex-1 border-none bg-transparent py-2 ps-10 pe-14 text-sm text-foreground outline-none placeholder:text-placeholder focus:ring-0 focus:outline-none"
            />
            <span className="absolute inset-e-2 rounded-md border border-border bg-card/60 px-2 py-0.5 text-xs text-muted">
              ESC
            </span>
          </div>
        </div>

        <Command.List className="max-h-96 overflow-y-auto p-2">
          <Command.Empty className="py-8 text-center text-sm text-muted">
            Aucune page ne correspond à votre recherche.
          </Command.Empty>

          {Object.entries(itemsBySection).map(
            ([sectionLabel, sectionItems]) => {
              if (sectionItems.length === 0) return null;
              return (
                <Command.Group
                  key={sectionLabel}
                  heading={sectionLabel}
                  className="py-1.5 **:[[cmdk-group-heading]]:px-3 **:[[cmdk-group-heading]]:py-1.5 **:[[cmdk-group-heading]]:text-[11px] **:[[cmdk-group-heading]]:font-semibold **:[[cmdk-group-heading]]:tracking-wider **:[[cmdk-group-heading]]:text-muted **:[[cmdk-group-heading]]:uppercase"
                >
                  {sectionItems.map((item) => (
                    <Command.Item
                      key={item.id}
                      value={`${item.section} ${item.parentTitle || ''} ${item.title} ${item.url}`}
                      onSelect={() => handleSelect(item.url)}
                      className="flex cursor-pointer items-center justify-between rounded-lg px-3 py-2.5 text-sm text-muted transition-colors hover:bg-card-hover data-[selected=true]:bg-card-hover data-[selected=true]:text-foreground"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex size-5 shrink-0 items-center justify-center text-muted">
                          <DashIcon icon={item.icon} width={18} height={18} />
                        </span>
                        <div className="flex items-center gap-1.5 truncate">
                          {item.parentTitle ? (
                            <span className="truncate font-normal text-placeholder">
                              {item.parentTitle} /
                            </span>
                          ) : null}
                          <span className="truncate text-foreground">
                            {item.title}
                          </span>
                        </div>
                      </div>
                      <span className="ms-3 hidden shrink-0 text-xs text-placeholder sm:inline">
                        {item.url}
                      </span>
                    </Command.Item>
                  ))}
                </Command.Group>
              );
            },
          )}
        </Command.List>

        <div className="flex items-center justify-between border-t border-border bg-search/60 px-4 py-2.5 text-xs text-muted">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px] shadow-sm">
                ↑
              </kbd>
              <kbd className="rounded border border-border bg-card px-1 py-0.5 font-mono text-[10px] shadow-sm">
                ↓
              </kbd>
              <span>Naviguer</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
                ↵
              </kbd>
              <span>Ouvrir</span>
            </span>
          </div>
          <div className="flex items-center gap-1">
            <kbd className="rounded border border-border bg-card px-1.5 py-0.5 font-mono text-[10px] shadow-sm">
              ESC
            </kbd>
            <span>Fermer</span>
          </div>
        </div>
      </Command.Dialog>
    </div>
  );
}
