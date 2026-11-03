import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // The public website is served at /; the private workspace is exposed at /portal
  // because /admin is reserved by the WordPress installation on the main domain.
  // Proxy the API through the Next.js origin so the httpOnly session cookie is first-party.
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API_URL}/api/:path*` },
      { source: '/portal', destination: '/admin' },
      { source: '/portal/:path*', destination: '/admin/:path*' },
    ];
  },
  poweredByHeader: false,
};

export default nextConfig;
