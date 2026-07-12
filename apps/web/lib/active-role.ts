/**
 * Active dashboard surface for the signed-in user.
 *
 * Product rule: one business role per account — either Owner or Agent
 * (never both). Platform admin is separate. The topbar switcher only
 * appears if multiple dashboard surfaces apply (rare).
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

export const ACTIVE_ROLE_LABELS: Record<ActiveRole, string> = {
  owner: 'Propriétaire',
  agent: 'Agent',
  admin: 'Admin',
};
