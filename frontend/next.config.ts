import type { NextConfig } from 'next';

const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const nextConfig: NextConfig = {
  // The public website is served at /; admin routes live under /admin.
  // Proxy the API through the Next.js origin so the httpOnly session cookie is first-party.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${API_URL}/api/:path*` }];
  },
  poweredByHeader: false,
};

export default nextConfig;
