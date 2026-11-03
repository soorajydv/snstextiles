import type { MetadataRoute } from 'next';
import { appPath } from '@/lib/paths';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SNS Textiles Factory Management',
    short_name: 'SNS Textiles',
    description: 'Order, production, billing and delivery management for SNS Textiles.',
    start_url: appPath('/dashboard'),
    scope: appPath('/'),
    display: 'standalone',
    orientation: 'any',
    background_color: '#f9f7f7',
    theme_color: '#112d4e',
    icons: [
      { src: appPath('/icon.svg'), sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
    ],
  };
}
