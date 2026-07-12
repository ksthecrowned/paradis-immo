import { apiFetch } from '@/lib/api';
import type { ActiveRole } from '@/lib/active-role';

export interface PublicUser {
  id: string;
  phone: string;
  email: string | null;
  name: string | null;
  avatarUrl: string | null;
  countryId: string;
  roles: string[];
  createdAt: string;
}

export interface PublicOrganization {
  id: string;
  name: string;
  type: string;
  memberRole: string;
}

export async function getMe(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/users/me');
}

export async function listMyOrganizations(): Promise<PublicOrganization[]> {
  return apiFetch<PublicOrganization[]>('/users/me/organizations');
}

export function resolveEligibleDashboardRoles(
  globalRoles: string[],
  organizations: PublicOrganization[],
): ActiveRole[] {
  const roles: ActiveRole[] = [];
  if (globalRoles.includes('PLATFORM_ADMIN')) roles.push('admin');

  // One business role per account: agency staff (AGENT/ADMIN) xor OWNER.
  const hasAgent = organizations.some(
    (o) => o.memberRole === 'AGENT' || o.memberRole === 'ADMIN',
  );
  const hasOwner = organizations.some((o) => o.memberRole === 'OWNER');
  if (hasAgent) roles.push('agent');
  else if (hasOwner) roles.push('owner');

  return [...new Set(roles)];
}

export function agentOrganizationIds(
  organizations: PublicOrganization[],
): string[] {
  return organizations
    .filter(
      (o) => o.memberRole === 'AGENT' || o.memberRole === 'ADMIN',
    )
    .map((o) => o.id);
}

export function isAgencyGerant(
  organizations: PublicOrganization[],
): boolean {
  return organizations.some((o) => o.memberRole === 'ADMIN');
}
