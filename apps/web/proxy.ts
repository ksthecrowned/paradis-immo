import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isWebAccountActive, resolveDashboardPath } from '@/lib/web-account';

const PROTECTED_PREFIXES = ['/owner', '/agent', '/admin'];
const AUTH_OPEN_PREFIXES = [
  '/login',
  '/register',
  '/auth/magic',
  '/auth/continue',
  '/onboarding/role',
];

function isAuthOpen(pathname: string): boolean {
  return AUTH_OPEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

/** Session user may nest fields under `.user` (session callback) or flat on auth. */
function gateUser(
  auth: {
    user?: {
      roles?: string[] | null;
      orgRoles?: string[] | null;
    } | null;
    roles?: string[] | null;
    orgRoles?: string[] | null;
  } | null,
): { roles?: string[] | null; orgRoles?: string[] | null } {
  if (!auth) return {};
  return {
    roles: auth.user?.roles ?? auth.roles ?? [],
    orgRoles: auth.user?.orgRoles ?? auth.orgRoles ?? [],
  };
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const user = gateUser(req.auth);
  const loggedIn =
    Boolean(req.auth) && req.auth?.error !== 'RefreshAccessTokenError';
  const active = loggedIn && isWebAccountActive(user);
  const home = active ? resolveDashboardPath(user) : '/onboarding/role';

  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }

  // Already set up → never park on login / register / role picker.
  if (active) {
    if (
      pathname === '/login' ||
      pathname === '/register' ||
      pathname === '/onboarding/role' ||
      pathname.startsWith('/login/') ||
      pathname.startsWith('/register/') ||
      pathname.startsWith('/onboarding/role/')
    ) {
      return NextResponse.redirect(new URL(home, req.nextUrl.origin));
    }
  }

  if (isAuthOpen(pathname)) {
    if (
      loggedIn &&
      !active &&
      (pathname === '/login' || pathname === '/register')
    ) {
      return NextResponse.redirect(
        new URL('/onboarding/role', req.nextUrl.origin),
      );
    }
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!loggedIn) {
    const login = new URL('/login', req.nextUrl.origin);
    login.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(login);
  }

  if (!active) {
    return NextResponse.redirect(
      new URL('/onboarding/role', req.nextUrl.origin),
    );
  }

  const roles = user.roles ?? [];
  const orgRoles = user.orgRoles ?? [];

  if (pathname.startsWith('/admin')) {
    if (!roles.includes('PLATFORM_ADMIN')) {
      return NextResponse.redirect(new URL(home, req.nextUrl.origin));
    }
    return NextResponse.next();
  }

  // One business role per account: owners stay on /owner, agency staff on /agent.
  if (pathname.startsWith('/owner') && !orgRoles.includes('OWNER')) {
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }
  if (
    pathname.startsWith('/agent') &&
    !orgRoles.includes('AGENT') &&
    !orgRoles.includes('ADMIN')
  ) {
    return NextResponse.redirect(new URL(home, req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/owner/:path*',
    '/agent/:path*',
    '/admin/:path*',
    '/onboarding/:path*',
    '/auth/continue',
    '/login',
    '/register',
    '/auth/magic',
  ],
};
