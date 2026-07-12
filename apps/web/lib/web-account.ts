export function isWebAccountActive(user: {
  roles?: string[] | null;
  orgRoles?: string[] | null;
}): boolean {
  const roles = user.roles ?? [];
  if (roles.includes('PLATFORM_ADMIN')) return true;
  const org = user.orgRoles ?? [];
  return org.includes('OWNER') || org.includes('AGENT');
}

export function resolveDashboardPath(user: {
  roles?: string[] | null;
  orgRoles?: string[] | null;
}): string {
  const roles = user.roles ?? [];
  if (roles.includes('PLATFORM_ADMIN')) return '/admin/dashboard';
  const org = user.orgRoles ?? [];
  if (org.includes('AGENT')) return '/agent/dashboard';
  if (org.includes('OWNER')) return '/owner/dashboard';
  return '/onboarding/role';
}
