import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site-data';
import { APP_BASE_PATH } from '@/lib/paths';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: [`${APP_BASE_PATH}/`, '/admin/', '/account', '/cart', '/checkout', '/api/'] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
