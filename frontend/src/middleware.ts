import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { APP_BASE_PATH } from '@/lib/paths';

const adminSegments = new Set([
  'activity',
  'attendance',
  'billing',
  'customers',
  'dashboard',
  'delivery',
  'forgot-password',
  'inventory',
  'invoice',
  'login',
  'orders',
  'production',
  'profile',
  'reports',
  'reset-password',
  'roles',
  'settings',
  'users',
]);

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split('/')[1];

  if (pathname === '/website') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    return NextResponse.redirect(url);
  }

  if (adminSegments.has(segment)) {
    const url = request.nextUrl.clone();
    url.pathname = `${APP_BASE_PATH}${pathname}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)'],
};
