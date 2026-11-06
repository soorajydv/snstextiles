import { z } from 'zod';
import { NECK_TYPES, PAYMENT_METHODS, SLEEVES } from '../../lib/constants';
import { ENQUIRY_STATUSES, REVIEW_STATUSES, SHOP_SIZES, STOCK_STATUSES } from './site.models';

const text = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => text(max).optional().default('');
const slug = z.string().trim().toLowerCase().max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens').or(z.literal(''));
const objectId = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id');
const url = text(1000);

export const categorySchema = z.object({
  name: text(80).min(1),
  slug: slug.optional().default(''),
  parent: objectId.nullable().or(z.literal('')).optional().default(null),
  description: optionalText(2000),
  image: url.optional().default(''),
  sortOrder: z.coerce.number().int().min(-9999).max(9999).optional().default(0),
  showOnHome: z.boolean().optional().default(false),
  published: z.boolean().optional().default(true),
});

export const productSchema = z.object({
  name: text(160).min(1),
  slug: slug.optional().default(''),
  sku: optionalText(80),
  shortDescription: optionalText(600),
  description: optionalText(20000),
  features: z.array(text(240)).max(30).optional().default([]),
  images: z.array(url).max(20).optional().default([]),
  categories: z.array(objectId).max(20).optional().default([]),
  tags: z.array(text(40)).max(30).optional().default([]),
  price: z.coerce.number().min(0).max(10_000_000),
  salePrice: z.coerce.number().min(0).max(10_000_000).nullable().optional().default(null),
  productConfig: text(120).min(1).optional().default('Jersey only — full sublimation'),
  neckTypes: z.array(z.enum(NECK_TYPES)).min(1).optional().default(['Round neck']),
  sleeves: z.array(z.enum(SLEEVES)).min(1).optional().default(['Half sleeve']),
  sizes: z.array(z.enum(SHOP_SIZES)).min(1).optional().default(['S', 'M', 'L', 'XL', '2XL']),
  colors: z.array(z.object({ name: text(40).min(1), hex: text(20).optional().default('') })).max(20).optional().default([]),
  allowPersonalisation: z.boolean().optional().default(true),
  allowDesignUpload: z.boolean().optional().default(true),
  minQuantity: z.coerce.number().int().min(1).max(5000).optional().default(1),
  stockStatus: z.enum(STOCK_STATUSES).optional().default('made_to_order'),
  featured: z.boolean().optional().default(false),
  published: z.boolean().optional().default(true),
  sortOrder: z.coerce.number().int().min(-9999).max(9999).optional().default(0),
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
}).refine((p) => p.salePrice === null || p.salePrice < p.price, { message: 'Sale price must be lower than the regular price', path: ['salePrice'] });

export const productPatchSchema = z.object({
  published: z.boolean().optional(),
  featured: z.boolean().optional(),
  stockStatus: z.enum(STOCK_STATUSES).optional(),
  sortOrder: z.coerce.number().int().min(-9999).max(9999).optional(),
});

export const pageSchema = z.object({
  title: text(160).min(1),
  slug: slug.optional().default(''),
  excerpt: optionalText(400),
  content: optionalText(100000),
  published: z.boolean().optional().default(true),
  showInFooter: z.boolean().optional().default(true),
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
});

export const postSchema = z.object({
  title: text(200).min(1),
  slug: slug.optional().default(''),
  excerpt: optionalText(600),
  content: optionalText(100000),
  coverImage: url.optional().default(''),
  tags: z.array(text(40)).max(20).optional().default([]),
  authorName: optionalText(80),
  published: z.boolean().optional().default(true),
  publishedAt: z.coerce.date().optional(),
  seoTitle: optionalText(160),
  seoDescription: optionalText(320),
});

const link = z.object({ label: text(60), href: text(500) });

export const siteSettingsSchema = z.object({
  brandName: text(80).min(1),
  tagline: optionalText(200),
  announcement: optionalText(240),
  announcementRight: optionalText(80),
  contact: z.object({
    phones: z.array(text(40)).max(5),
    email: z.email().or(z.literal('')),
    whatsapp: optionalText(40),
    address: optionalText(300),
    openingHours: optionalText(200),
    mapEmbedUrl: z.string().trim().max(2000).refine((v) => !v || /^https:\/\/(www\.)?google\.[a-z.]+\/maps\/embed/.test(v), 'Paste the https://www.google.com/maps/embed… link from Google Maps → Share → Embed').optional().default(''),
  }),
  social: z.object({ facebook: url, instagram: url, tiktok: url, youtube: url }),
  hero: z.object({ kicker: text(60), titleLine1: text(40), titleLine2: text(40), subtitle: text(300), primaryCta: link, secondaryCta: link, image: url }),
  banner: z.object({ kicker: text(60), title: text(40), highlight: text(40), subtitle: text(200), cta: link, image: url }),
  story: z.object({ kicker: text(60), title: text(120), body: text(2000) }),
  faqs: z.array(z.object({ q: text(200).min(1), a: text(2000).min(1) })).max(40),
  testimonials: z.array(z.object({ name: text(80).min(1), role: optionalText(80), quote: text(600).min(1) })).max(30),
  gallery: z.array(url).max(24),
  checkout: z.object({
    minLeadDays: z.coerce.number().int().min(0).max(120),
    deliveryMethods: z.array(text(80).min(1)).min(1).max(8),
    deliveryNote: optionalText(600),
    paymentInstructions: optionalText(3000),
  }),
  seo: z.object({ title: text(160), description: text(320) }),
});

export const enquiryUpdateSchema = z.object({ status: z.enum(ENQUIRY_STATUSES).optional(), notes: z.string().trim().max(4000).optional() });
export const reviewUpdateSchema = z.object({ status: z.enum(REVIEW_STATUSES) });

// ---------- public ----------

export const enquirySchema = z.object({
  type: z.enum(['custom', 'contact']).default('contact'),
  name: text(120).min(2, 'Please enter your name'),
  email: z.email('Please enter a valid email'),
  phone: optionalText(40),
  team: optionalText(120),
  product: optionalText(120),
  quantity: z.coerce.number().int().min(1).max(100000).optional().or(z.literal('').transform(() => undefined)),
  neededBy: z.coerce.date().optional().or(z.literal('').transform(() => undefined)),
  subject: optionalText(160),
  message: text(4000).min(5, 'Please tell us a little more'),
  website: z.string().max(0).optional(), // honeypot – must stay empty
});

export const reviewSchema = z.object({
  productId: objectId,
  name: text(80).min(2, 'Please enter your name'),
  email: z.email('Please enter a valid email').or(z.literal('')).optional().default(''),
  rating: z.coerce.number().int().min(1).max(5),
  body: text(2000).min(5, 'Please write a short review'),
});

export const subscribeSchema = z.object({ email: z.email('Please enter a valid email') });
export const trackSchema = z.object({ orderNo: text(40).min(2), email: z.email('Please enter the email used for the order') });

const playerLine = z.object({ name: optionalText(60), number: optionalText(6), size: z.enum(SHOP_SIZES).or(z.literal('')).optional().default('') });

export const checkoutItemSchema = z.object({
  productId: objectId,
  sizes: z.partialRecord(z.enum(SHOP_SIZES), z.coerce.number().int().min(0).max(5000)),
  sleeve: z.enum(SLEEVES).optional(),
  neckType: z.enum(NECK_TYPES).optional(),
  color: optionalText(40),
  teamName: optionalText(120),
  players: z.array(playerLine).max(5000).optional().default([]),
  notes: optionalText(2000),
});

export const checkoutSchema = z.object({
  items: z.array(checkoutItemSchema).min(1, 'Your cart is empty').max(20),
  dueDate: z.coerce.date(),
  shipping: z.object({
    method: text(80).min(1),
    recipient: text(120).min(2, 'Enter the recipient name'),
    phone: text(40).min(6, 'Enter a phone number'),
    address: optionalText(400),
    city: optionalText(80),
  }),
  notes: optionalText(2000),
  advance: z.object({
    amount: z.coerce.number().min(0).max(100_000_000).default(0),
    method: z.enum(PAYMENT_METHODS).default('eSewa'),
    reference: optionalText(120),
  }).optional().default({ amount: 0, method: 'eSewa', reference: '' }),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;
