import { cache } from 'react';
import type { SiteCategory, SitePage, SitePost, SiteProduct, SiteReview, SiteSettings } from './types';

const API_URL = (process.env.API_URL ?? 'http://localhost:4000').replace(/\/$/, '');
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://snstextiles.com').replace(/\/$/, '');

export class SiteApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

/** Server-side GET against the public website API, cached briefly so admin edits appear within ~30s. */
export async function siteGet<T>(path: string, revalidate = 30): Promise<T> {
  const res = await fetch(`${API_URL}/api/public/site${path}`, { next: { revalidate } });
  if (!res.ok) throw new SiteApiError(res.status, `Website API ${res.status} for ${path}`);
  return res.json() as Promise<T>;
}

/** Like siteGet but returns null for missing/restricted data or an unreachable API during builds. */
export async function siteFind<T>(path: string): Promise<T | null> {
  try {
    return await siteGet<T>(path);
  } catch (error) {
    if (error instanceof SiteApiError && [401, 403, 404].includes(error.status)) {
      console.warn(`[site] Public API returned ${error.status} for ${path}; using fallback content.`);
      return null;
    }
    if (error instanceof SiteApiError) throw error;
    console.error('[site] API unavailable:', (error as Error).message);
    return null;
  }
}

export type Shell = { settings: SiteSettings; categories: SiteCategory[]; footerPages: { title: string; slug: string }[] };

export const FALLBACK_SETTINGS: SiteSettings = {
  brandName: 'SNS Textiles',
  tagline: 'Premium custom sportswear, made in Nepal.',
  announcement: 'Premium custom sportswear · Made in Nepal · Teams · Clubs · Schools · Businesses',
  announcementRight: 'Worldwide shipping',
  contact: { phones: ['+977 9827330740', '+977 9763473823'], email: 'snstextiles0923@gmail.com', whatsapp: '', address: 'Kalanki, Kathmandu, Nepal', openingHours: '', mapEmbedUrl: '' },
  social: { facebook: 'https://www.facebook.com/profile.php?id=61554817139193', instagram: 'https://www.instagram.com/snssports.np/', tiktok: '', youtube: '' },
  hero: { kicker: 'Custom sportswear', titleLine1: 'Designed', titleLine2: 'to move', subtitle: 'Premium teamwear, made for the way your team plays — designed with you and made in Nepal.', primaryCta: { label: 'Shop collection', href: '/shop' }, secondaryCta: { label: 'Custom design', href: '/custom-jersey' }, image: '' },
  banner: { kicker: 'Create your own', title: 'Custom', highlight: 'sportswear', subtitle: 'Your team. Your design. No limits.', cta: { label: 'Create your jersey', href: '/custom-jersey' }, image: '' },
  story: { kicker: 'Made in Nepal', title: 'Built for your team. Made to last.', body: 'At SNS Textiles we manufacture high-end football, cricket and basketball jerseys and other premium sportswear.' },
  faqs: [],
  testimonials: [],
  gallery: [],
  checkout: { minLeadDays: 10, deliveryMethods: ['Delivery to my address', 'Pickup from workshop'], deliveryNote: '', paymentInstructions: '' },
  seo: { title: 'SNS Textiles — Custom Sportswear Made in Nepal', description: 'Premium custom jerseys and sportswear for teams, clubs, schools and businesses. Made in Nepal.' },
};

export const getShell = cache(async (): Promise<Shell> => {
  const shell = await siteFind<Shell>('/settings');
  return shell ?? { settings: FALLBACK_SETTINGS, categories: [], footerPages: [] };
});

export type ProductQuery = { products: SiteProduct[]; total: number; page: number; limit: number; priceRange: { min: number; max: number } };
export const EMPTY_PRODUCTS: ProductQuery = { products: [], total: 0, page: 1, limit: 12, priceRange: { min: 0, max: 0 } };

export async function getProducts(params: Record<string, string | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v) qs.set(k, v);
  return (await siteFind<ProductQuery>(`/products?${qs}`)) ?? EMPTY_PRODUCTS;
}

export const getProduct = cache((slug: string) => siteFind<{ product: SiteProduct; related: SiteProduct[]; reviews: SiteReview[] }>(`/products/${encodeURIComponent(slug)}`));
export const getPage = cache((slug: string) => siteFind<{ page: SitePage }>(`/pages/${encodeURIComponent(slug)}`));
export const getPost = cache((slug: string) => siteFind<{ post: SitePost; more: SitePost[] }>(`/posts/${encodeURIComponent(slug)}`));
export async function getPosts(page = 1, limit = 9) {
  return (await siteFind<{ posts: SitePost[]; total: number; page: number; limit: number }>(`/posts?page=${page}&limit=${limit}`)) ?? { posts: [], total: 0, page: 1, limit };
}
