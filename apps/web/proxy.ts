import { NextResponse } from 'next/server';
import { auth } from '@/auth';

const PROTECTED_PREFIXES = ['/owner', '/agent', '/admin'];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;

  if (pathname === '/admin/login') {
    if (
      req.auth &&
      !req.auth.error &&
      (req.auth.user?.roles ?? []).includes('PLATFORM_ADMIN')
    ) {
      return NextResponse.redirect(
        new URL('/admin/dashboard', req.nextUrl.origin),
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

  if (!req.auth || req.auth.error === 'RefreshAccessTokenError') {
    const loginPath = pathname.startsWith('/admin')
      ? '/admin/login'
      : '/login';
    const login = new URL(loginPath, req.nextUrl.origin);
    login.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(login);
  }

  if (pathname.startsWith('/admin')) {
    const roles = req.auth.user?.roles ?? [];
    if (!roles.includes('PLATFORM_ADMIN')) {
      return NextResponse.redirect(
        new URL('/owner/dashboard', req.nextUrl.origin),
      );
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/owner/:path*', '/agent/:path*', '/admin/:path*'],
};
