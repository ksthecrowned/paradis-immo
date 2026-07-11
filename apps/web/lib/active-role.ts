/**
 * Active role for users with multiple roles.
 *
 * A single Paradis Immo user can hold several roles (e.g. a property
 * owner who is also an agent, or an admin who also has a personal
 * tenant account). The Topbar exposes a role switcher; the active
 * role is persisted in `localStorage` and read on every render so
 * the sidebar nav and header can adapt without a page reload.
 *
 * The mapping is intentionally narrow: only roles that correspond to
 * a dashboard surface are valid (`owner`, `agent`, `admin`).
 */

import type { DashboardRole } from '@/components/dashboard/sidebar-nav';

export type ActiveRole = DashboardRole;

const STORAGE_KEY = 'paradisImmo.activeRole';

const ROLE_PRIORITY: ActiveRole[] = ['admin', 'agent', 'owner'];

function isActiveRole(value: unknown): value is ActiveRole {
  return value === 'owner' || value === 'agent' || value === 'admin';
}

function readStore(): Storage | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    return window.localStorage;
  }
  const g = globalThis as { localStorage?: Storage };
  return g.localStorage ?? null;
}

/**
 * Resolve the dashboard role to use for a user.
 *
 * - If a previously stored value is still in the user's role set, use it.
 * - Otherwise pick the highest-priority role the user has.
 * - The `availableRoles` list drives both the switcher and the resolver
 *   so the active role can never escape the user's actual permissions.
 */
export function resolveActiveRole(availableRoles: string[]): ActiveRole {
  const eligible = availableRoles.filter(isActiveRole);
  if (eligible.length === 0) return 'owner';
  const store = readStore();
  const stored = store?.getItem(STORAGE_KEY);
  if (isActiveRole(stored) && eligible.includes(stored)) {
    return stored;
  }
  const fallback = ROLE_PRIORITY.find((r) => eligible.includes(r)) ?? 'owner';
  return fallback;
}

export function setActiveRole(role: ActiveRole): void {
  const store = readStore();
  if (!store) return;
  store.setItem(STORAGE_KEY, role);
}

export function clearActiveRole(): void {
  const store = readStore();
  if (!store) return;
  store.removeItem(STORAGE_KEY);
}

/**
 * Human label for the role switcher — French UI, English role key.
 */
export const ACTIVE_ROLE_LABELS: Record<ActiveRole, string> = {
  owner: 'Propriétaire',
  agent: 'Agent',
  admin: 'Admin',
};
