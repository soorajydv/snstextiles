import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SNS Textiles Factory Management',
    short_name: 'SNS Textiles',
    description: 'Order, production, billing and delivery management for SNS Textiles.',
    start_url: '/admin/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'any',
    background_color: '#f9f7f7',
    theme_color: '#112d4e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
