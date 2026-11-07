import type { MetadataRoute } from 'next';
import { SITE_URL, siteFind } from '@/lib/site-data';

export const revalidate = 3600;

type SitemapData = { products: { slug: string; updatedAt: string }[]; pages: { slug: string; updatedAt: string }[]; posts: { slug: string; updatedAt: string }[]; categories: { slug: string }[] };

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const data = await siteFind<SitemapData>('/sitemap');
  const fixed = ['', '/shop', '/custom-jersey', '/blog', '/contact', '/faq', '/order-tracking'].map((path) => ({ url: `${SITE_URL}${path}`, changeFrequency: 'weekly' as const, priority: path === '' ? 1 : 0.8 }));
  if (!data) return fixed;
  return [
    ...fixed,
    ...data.categories.map((c) => ({ url: `${SITE_URL}/category/${c.slug}`, changeFrequency: 'weekly' as const, priority: 0.7 })),
    ...data.products.map((p) => ({ url: `${SITE_URL}/product/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })),
    ...data.pages.map((p) => ({ url: `${SITE_URL}/${p.slug}`, lastModified: p.updatedAt, priority: 0.4 })),
    ...data.posts.map((p) => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: p.updatedAt, priority: 0.5 })),
  ];
}
