const ALLOWED_PREFIXES = [
  '/(tabs)',
  '/property/',
  '/payment/',
  '/visits/',
  '/visit-detail/',
  '/stays/',
  '/leases/',
  '/purchases/',
  '/achats/',
  '/activity',
  '/notifications',
  '/profile/',
  '/portfolio/',
  '/cahier-loyer',
] as const;

/** Whitelist internal paths used for post-login redirects. */
export function sanitizeReturnTo(path: string | undefined): string {
  if (
    !path ||
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    path.includes('..')
  ) {
    return '/(tabs)';
  }
  const pathname = path.split(/[?#]/, 1)[0] ?? '';
  const allowed = ALLOWED_PREFIXES.some(
    (prefix) =>
      pathname === prefix ||
      pathname.startsWith(prefix.endsWith('/') ? prefix : `${prefix}/`),
  );
  return allowed ? path : '/(tabs)';
}
