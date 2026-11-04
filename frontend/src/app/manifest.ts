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
      { src: appPath('/sns-favicon.png'), sizes: '1254x1254', type: 'image/png', purpose: 'any' },
    ],
  };
}
