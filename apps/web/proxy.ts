import { auth } from '@/auth';
import { NextResponse } from 'next/server';

const PROTECTED_PREFIXES = ['/owner', '/agent', '/admin'];

export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
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
