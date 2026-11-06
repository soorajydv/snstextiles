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
  'register',
  'reset-password',
  'roles',
  'settings',
  'site',
  'users',
]);

/** Old WordPress / WooCommerce addresses mapped to the new site so links and search results keep working. */
const LEGACY_PATHS: Record<string, string> = {
  '/website': '/',
  '/store': '/shop',
  '/blogs': '/blog',
  '/signup': '/account/register',
  '/my-account': '/account',
};

function legacyRedirect(pathname: string): string | null {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (LEGACY_PATHS[clean]) return LEGACY_PATHS[clean];
  // /product-category/sports-wear/football-jersey/ → /category/football-jersey
  if (clean.startsWith('/product-category/')) {
    const parts = clean.split('/').filter(Boolean);
    const pageIndex = parts.indexOf('page');
    const slugs = pageIndex > 0 ? parts.slice(1, pageIndex) : parts.slice(1);
    const page = pageIndex > 0 ? parts[pageIndex + 1] : '';
    return slugs.length ? `/category/${slugs[slugs.length - 1]}${page ? `?page=${page}` : ''}` : '/shop';
  }
  // /shop/page/3/ → /shop?page=3
  const shopPage = /^\/shop\/page\/(\d+)$/.exec(clean);
  if (shopPage) return `/shop?page=${shopPage[1]}`;
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split('/')[1];

  const legacy = legacyRedirect(pathname);
  if (legacy) {
    const url = request.nextUrl.clone();
    const [path, query] = legacy.split('?');
    url.pathname = path;
    if (query) url.search = `?${query}`;
    return NextResponse.redirect(url, 301);
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
