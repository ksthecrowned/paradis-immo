import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { isWebAccountActive, resolveDashboardPath } from '@/lib/web-account';

const PROTECTED_PREFIXES = ['/owner', '/agent', '/admin'];
const AUTH_OPEN_PREFIXES = [
  '/login',
  '/register',
  '/auth/magic',
  '/onboarding/role',
];

function isAuthOpen(pathname: string): boolean {
  return AUTH_OPEN_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );
}

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.redirect(new URL('/login', req.nextUrl.origin));
  }

  if (isAuthOpen(pathname)) {
    return NextResponse.next();
  }

  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  if (!req.auth || req.auth.error === 'RefreshAccessTokenError') {
    const login = new URL('/login', req.nextUrl.origin);
    login.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(login);
  }

  const user = req.auth.user;
  if (!isWebAccountActive(user ?? {})) {
    return NextResponse.redirect(
      new URL('/onboarding/role', req.nextUrl.origin),
    );
  }

  const roles = user?.roles ?? [];
  const orgRoles = user?.orgRoles ?? [];
  const home = resolveDashboardPath(user ?? {});

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
    '/login',
    '/register',
    '/auth/magic',
  ],
};
