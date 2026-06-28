import { type NextRequest, NextResponse } from 'next/server';

const PUBLIC_PATHS = ['/login'];
const TENANT_ADMIN_PATHS = ['/overview', '/api-keys', '/webhooks', '/settings', '/users'];
const SYSTEM_ADMIN_PATHS = ['/tenants'];
const Role = {
  SYSTEM_ADMIN: 'SYSTEM_ADMIN',
  TENANT_ADMIN: 'TENANT_ADMIN',
  CUSTOMER: 'CUSTOMER',
} as const;

type Role = (typeof Role)[keyof typeof Role];

const Token = {
  ADMIN_ACCESS_TOKEN: 'admin_access_token',
  ADMIN_REFRESH_TOKEN: 'admin_refresh_token',
  ADMIN_USER_ROLE: 'admin_user_role',
} as const;

type Token = (typeof Token)[keyof typeof Token];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasRefreshToken = !!request.cookies.get(Token.ADMIN_REFRESH_TOKEN)?.value;
  const isAuthenticated =  hasRefreshToken;
  const role = request.cookies.get(Token.ADMIN_USER_ROLE)?.value;
  const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

  if (!isAuthenticated && !isPublic) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (isAuthenticated && isPublic) {
    const landing = role === Role.SYSTEM_ADMIN ? '/tenants' : '/overview';
    return NextResponse.redirect(new URL(landing, request.url));
  }

  if (isAuthenticated && pathname === '/') {
    const landing = role === Role.SYSTEM_ADMIN ? '/tenants' : '/overview';
    return NextResponse.redirect(new URL(landing, request.url));
  }

  // CUSTOMER role has no business in the dashboard
  if (isAuthenticated && role === Role.CUSTOMER) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Block SYSTEM_ADMIN from TENANT_ADMIN-only pages
  if (role === Role.SYSTEM_ADMIN && TENANT_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/tenants', request.url));
  }

  // Block TENANT_ADMIN from SYSTEM_ADMIN-only pages
  if (role === Role.TENANT_ADMIN && SYSTEM_ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/overview', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api).*)'],
};
