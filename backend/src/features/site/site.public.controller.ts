import type { Request, Response } from 'express';
import { badRequest, parse } from '../../lib/http';
import { removeUploadedFiles } from '../../lib/uploads';
import { currentUser } from '../../middleware/auth';
import {
  checkout, createEnquiry, createReview, getCartPrices, getPublicMedia, getPublicPage, getPublicPost, getPublicProduct, getSiteShell,
  getSitemap, listPublicCategories, listPublicPosts, listPublicProducts, subscribe,
} from './site.public.service';
import { trackOrder } from './site.service';
import { enquirySchema, reviewSchema, subscribeSchema, trackSchema } from './site.validation';

const cacheShort = (res: Response) => res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
const uploadedFiles = (req: Request) => (req.files as Express.Multer.File[] | undefined) ?? [];

// ---------- site shell ----------

export async function siteShellController(_req: Request, res: Response) {
  const shell = await getSiteShell();
  cacheShort(res);
  res.json(shell);
}

export async function mediaController(req: Request, res: Response) {
  const media = await getPublicMedia(String(req.params.storedName));
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  res.type(media.mimeType).sendFile(media.path, (err) => { if (err && !res.headersSent) res.status(404).end(); });
}

// ---------- catalogue ----------

export async function categoriesController(_req: Request, res: Response) {
  cacheShort(res);
  res.json(await listPublicCategories());
}

export async function productsController(req: Request, res: Response) {
  cacheShort(res);
  res.json(await listPublicProducts(req.query as Record<string, unknown>));
}

export async function productController(req: Request, res: Response) {
  const result = await getPublicProduct(String(req.params.slug));
  cacheShort(res);
  res.json(result);
}

export async function cartPricesController(req: Request, res: Response) {
  res.json(await getCartPrices(req.body?.ids));
}

// ---------- content ----------

export async function pageController(req: Request, res: Response) {
  const result = await getPublicPage(String(req.params.slug));
  cacheShort(res);
  res.json(result);
}

export async function postsController(req: Request, res: Response) {
  const result = await listPublicPosts(req.query as Record<string, unknown>);
  cacheShort(res);
  res.json(result);
}

export async function postController(req: Request, res: Response) {
  const result = await getPublicPost(String(req.params.slug));
  cacheShort(res);
  res.json(result);
}

export async function sitemapController(_req: Request, res: Response) {
  const result = await getSitemap();
  cacheShort(res);
  res.json(result);
}

// ---------- forms ----------

export async function enquiryController(req: Request, res: Response) {
  const files = uploadedFiles(req);
  try {
    const body = parse(enquirySchema, req.body);
    if (body.website) { removeUploadedFiles(files); res.status(201).json({ ok: true }); return; } // bot
    res.status(201).json(await createEnquiry(body, files));
  } catch (error) {
    removeUploadedFiles(files);
    throw error;
  }
}

export async function reviewController(req: Request, res: Response) {
  const body = parse(reviewSchema, req.body);
  res.status(201).json(await createReview(body));
}

export async function subscribeController(req: Request, res: Response) {
  const { email } = parse(subscribeSchema, req.body);
  res.status(201).json(await subscribe(email));
}

export async function trackController(req: Request, res: Response) {
  const { orderNo, email } = parse(trackSchema, req.body);
  res.json({ order: await trackOrder(orderNo, email) });
}

// ---------- checkout (signed-in customers) ----------

function parseMultipartJson(req: Request) {
  if (typeof req.body?.data !== 'string') return req.body;
  try { return JSON.parse(req.body.data); } catch { throw badRequest('Malformed checkout data'); }
}

export async function checkoutController(req: Request, res: Response) {
  const user = currentUser(req);
  const files = uploadedFiles(req);
  try {
    res.status(201).json(await checkout(user, () => parseMultipartJson(req), files));
  } catch (error) {
    removeUploadedFiles(files);
    throw error;
  }
}
