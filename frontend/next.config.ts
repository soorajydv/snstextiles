import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';
const APP_BASE_PATH = (process.env.NEXT_PUBLIC_APP_BASE_PATH ?? '/portal').replace(/\/$/, '') || '/';

const nextConfig: NextConfig = {
  // The public website is served at /; the private workspace is exposed at /portal
  // because /admin is reserved by the WordPress installation on the main domain.
  // Proxy the API through the Next.js origin so the httpOnly session cookie is first-party.
  assetPrefix: APP_BASE_PATH,
  async rewrites() {
    return [
      { source: `${APP_BASE_PATH}/api/:path*`, destination: `${API_URL}/api/:path*` },
      { source: `${APP_BASE_PATH}/_next/:path*`, destination: '/_next/:path*' },
      { source: `${APP_BASE_PATH}/manifest.webmanifest`, destination: '/manifest.webmanifest' },
      { source: `${APP_BASE_PATH}/sw.js`, destination: '/sw.js' },
      { source: `${APP_BASE_PATH}/icon.svg`, destination: '/icon.svg' },
      { source: `${APP_BASE_PATH}/sns-favicon.png`, destination: '/sns-favicon.png' },
      { source: APP_BASE_PATH, destination: '/admin' },
      { source: `${APP_BASE_PATH}/:path*`, destination: '/admin/:path*' },
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
