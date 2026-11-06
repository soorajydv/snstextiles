import crypto from 'crypto';
import path from 'path';
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import rateLimit from 'express-rate-limit';
import { env } from '../../config/env';
import { badRequest, notFound, parse } from '../../lib/http';
import { ALLOWED_EXTENSIONS, compressUploadedImage, removeUploadedFiles, storedFilePath, upload } from '../../lib/uploads';
import { currentUser, requireAuth, requirePermission } from '../../middleware/auth';
import {
  SiteEnquiry, SiteMedia, SitePage, SitePost, SiteProduct, SiteReview, SiteSubscriber, getSiteSettings,
} from './site.models';
import {
  categoriesWithCounts, effectivePrice, notifyNewEnquiry, pageDto, placeWebsiteOrders, postDto, productDto, queryProducts,
  reviewDto, settingsDto, trackOrder,
} from './site.service';
import { checkoutSchema, enquirySchema, reviewSchema, subscribeSchema, trackSchema } from './site.validation';

const router = Router();

const limiter = (limit: number, windowMinutes = 15) => rateLimit({
  windowMs: windowMinutes * 60 * 1000,
  limit,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: 'Too many requests. Please try again in a few minutes.' },
});

const enquiryUpload = multer({
  storage: multer.diskStorage({
    destination: env.uploadDir,
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`),
  }),
  limits: { fileSize: Math.min(env.maxUploadBytes, 10 * 1024 * 1024), files: 4 },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_EXTENSIONS.includes(path.extname(file.originalname).toLowerCase())) { cb(badRequest('Upload PNG, JPG, PDF, AI, EPS, SVG, PSD or CDR files')); return; }
    cb(null, true);
  },
});

const cacheShort = (res: Response) => res.set('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');

// ---------- site shell ----------

router.get('/settings', async (_req, res) => {
  const [settings, categories, footerPages] = await Promise.all([
    getSiteSettings(),
    categoriesWithCounts(true),
    SitePage.find({ published: true, showInFooter: true }).select('title slug').sort({ title: 1 }).lean(),
  ]);
  cacheShort(res);
  res.json({ settings: settingsDto(settings), categories, footerPages: footerPages.map((p) => ({ title: p.title, slug: p.slug })) });
});

router.get('/media/:storedName', async (req, res) => {
  const storedName = path.basename(String(req.params.storedName));
  const media = await SiteMedia.findOne({ storedName }).lean();
  if (!media) throw notFound('Image not found');
  res.set('Cache-Control', 'public, max-age=31536000, immutable');
  res.set('X-Content-Type-Options', 'nosniff');
  res.type(media.mimeType).sendFile(storedFilePath(storedName), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// ---------- catalogue ----------

router.get('/categories', async (_req, res) => {
  cacheShort(res);
  res.json({ categories: await categoriesWithCounts(true) });
});

router.get('/products', async (req, res) => {
  cacheShort(res);
  res.json(await queryProducts(req.query as Record<string, unknown>));
});

router.get('/products/:slug', async (req, res) => {
  const product = await SiteProduct.findOne({ slug: String(req.params.slug).toLowerCase(), published: true }).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  const categoryIds = (product.categories as unknown as { _id: unknown }[]).map((c) => c._id);
  const relatedFilter: Record<string, unknown> = { _id: { $ne: product._id }, published: true };
  if (categoryIds.length) relatedFilter.categories = { $in: categoryIds };
  const [related, reviews] = await Promise.all([
    SiteProduct.find(relatedFilter)
      .sort({ featured: -1, salesCount: -1, createdAt: -1 }).limit(8).populate('categories', 'name slug').lean(),
    SiteReview.find({ product: product._id, status: 'approved' }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  cacheShort(res);
  res.json({ product: productDto(product), related: related.map((p) => productDto(p)), reviews: reviews.map((r) => reviewDto(r)) });
});

/** Current prices for the cart page (the server always re-prices at checkout). */
router.post('/cart/prices', async (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? (req.body.ids as unknown[]).filter((v): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)).slice(0, 50) : [];
  const products = await SiteProduct.find({ _id: { $in: ids } }).lean();
  res.json({
    products: products.map((p) => ({
      id: String(p._id), slug: p.slug, name: p.name, image: p.images[0] ?? '', price: effectivePrice(p),
      available: p.published && p.stockStatus !== 'out_of_stock', minQuantity: p.minQuantity, sizes: p.sizes, allowDesignUpload: p.allowDesignUpload !== false,
    })),
  });
});

// ---------- content ----------

router.get('/pages/:slug', async (req, res) => {
  const page = await SitePage.findOne({ slug: String(req.params.slug).toLowerCase(), published: true }).lean();
  if (!page) throw notFound('Page not found');
  cacheShort(res);
  res.json({ page: pageDto(page) });
});

router.get('/posts', async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(req.query.limit) || 9));
  const filter = { published: true, publishedAt: { $lte: new Date() } };
  const [posts, total] = await Promise.all([
    SitePost.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SitePost.countDocuments(filter),
  ]);
  cacheShort(res);
  res.json({ posts: posts.map((p) => postDto(p, false)), total, page, limit });
});

router.get('/posts/:slug', async (req, res) => {
  const post = await SitePost.findOne({ slug: String(req.params.slug).toLowerCase(), published: true, publishedAt: { $lte: new Date() } }).lean();
  if (!post) throw notFound('Post not found');
  const more = await SitePost.find({ _id: { $ne: post._id }, published: true, publishedAt: { $lte: new Date() } }).sort({ publishedAt: -1 }).limit(3).lean();
  cacheShort(res);
  res.json({ post: postDto(post), more: more.map((p) => postDto(p, false)) });
});

/** Everything the sitemap needs in one call. */
router.get('/sitemap', async (_req, res) => {
  const [products, pages, posts, categories] = await Promise.all([
    SiteProduct.find({ published: true }).select('slug updatedAt').lean(),
    SitePage.find({ published: true }).select('slug updatedAt').lean(),
    SitePost.find({ published: true, publishedAt: { $lte: new Date() } }).select('slug updatedAt').lean(),
    categoriesWithCounts(true),
  ]);
  cacheShort(res);
  res.json({
    products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    pages: pages.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    posts: posts.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    categories: categories.map((c) => ({ slug: c.slug })),
  });
});

// ---------- forms ----------

router.post('/enquiries', limiter(8), enquiryUpload.array('files', 4), async (req, res) => {
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  try {
    const body = parse(enquirySchema, req.body);
    if (body.website) { removeUploadedFiles(files); res.status(201).json({ ok: true }); return; } // bot
    await Promise.all(files.map(compressUploadedImage));
    const enquiry = await SiteEnquiry.create({
      type: body.type, name: body.name, email: body.email, phone: body.phone, team: body.team, product: body.product,
      quantity: body.quantity ?? null, neededBy: body.neededBy ?? null, subject: body.subject, message: body.message,
      files: files.map((f) => ({ storedName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size })),
    });
    void notifyNewEnquiry({ type: enquiry.type, name: enquiry.name, email: enquiry.email, phone: enquiry.phone, message: enquiry.message, product: enquiry.product, team: enquiry.team });
    res.status(201).json({ ok: true });
  } catch (error) {
    removeUploadedFiles(files);
    throw error;
  }
});

router.post('/reviews', limiter(6, 60), async (req, res) => {
  const body = parse(reviewSchema, req.body);
  if (!(await SiteProduct.exists({ _id: body.productId, published: true }))) throw notFound('Product not found');
  await SiteReview.create({ product: body.productId, name: body.name, email: body.email, rating: body.rating, body: body.body, status: 'pending' });
  res.status(201).json({ ok: true, message: 'Thank you! Your review will appear once it has been approved.' });
});

router.post('/subscribe', limiter(10, 60), async (req, res) => {
  const { email } = parse(subscribeSchema, req.body);
  await SiteSubscriber.updateOne({ email: email.toLowerCase() }, { $set: { active: true }, $setOnInsert: { source: 'website' } }, { upsert: true });
  res.status(201).json({ ok: true });
});

router.post('/track', limiter(20), async (req, res) => {
  const { orderNo, email } = parse(trackSchema, req.body);
  res.json({ order: await trackOrder(orderNo, email) });
});

// ---------- checkout (signed-in customers) ----------

function parseMultipartJson(req: Request) {
  if (typeof req.body?.data !== 'string') return req.body;
  try { return JSON.parse(req.body.data); } catch { throw badRequest('Malformed checkout data'); }
}

router.post('/checkout', limiter(15), requireAuth, requirePermission('orders.create'), upload.any(), async (req, res) => {
  const user = currentUser(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const allowedFields = /^(design_\d{1,2}|advanceProof)$/;
  try {
    if (files.some((f) => !allowedFields.test(f.fieldname))) throw badRequest('Unexpected file upload');
    if (files.filter((f) => f.fieldname === 'advanceProof').length > 1) throw badRequest('advanceProof: Upload one payment screenshot');
    await Promise.all(files.map(compressUploadedImage));
    const input = parse(checkoutSchema, parseMultipartJson(req));
    const result = await placeWebsiteOrders(user, input, files);
    // Remove uploads that did not end up on an order (e.g. files for an index that does not exist).
    const itemCount = input.items.length;
    removeUploadedFiles(files.filter((f) => f.fieldname.startsWith('design_') && Number(f.fieldname.slice(7)) >= itemCount));
    res.status(201).json(result);
  } catch (error) {
    removeUploadedFiles(files);
    throw error;
  }
});

export default router;
