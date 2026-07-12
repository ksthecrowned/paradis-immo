export function isWebAccountActive(user: {
  roles?: string[] | null;
  orgRoles?: string[] | null;
}): boolean {
  const roles = user.roles ?? [];
  if (roles.includes('PLATFORM_ADMIN')) return true;
  const org = user.orgRoles ?? [];
  return (
    org.includes('OWNER') ||
    org.includes('AGENT') ||
    org.includes('ADMIN')
  );
}

function isAgencyStaff(org: string[]): boolean {
  return org.includes('AGENT') || org.includes('ADMIN');
}

export function resolveDashboardPath(user: {
  roles?: string[] | null;
  orgRoles?: string[] | null;
}): string {
  const roles = user.roles ?? [];
  if (roles.includes('PLATFORM_ADMIN')) return '/admin/dashboard';
  const org = user.orgRoles ?? [];
  // One business role per account (agency staff xor OWNER). Prefer agency
  // if both appear in bad data so we never strand staff on the owner shell.
  if (isAgencyStaff(org) && !org.includes('OWNER')) return '/agent/dashboard';
  if (org.includes('OWNER') && !isAgencyStaff(org)) return '/owner/dashboard';
  if (isAgencyStaff(org)) return '/agent/dashboard';
  if (org.includes('OWNER')) return '/owner/dashboard';
  return '/onboarding/role';
}
