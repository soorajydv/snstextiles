import fs from 'fs';
import path from 'path';
import { Router } from 'express';
import multer from 'multer';
import { Types } from 'mongoose';
import { audit } from '../../lib/audit';
import { assertObjectId, badRequest, escapeRegex, notFound, pagination, parse } from '../../lib/http';
import { isInlineSafe, storedFilePath } from '../../lib/uploads';
import { currentUser, requirePermission } from '../../middleware/auth';
import { Order } from '../../models/Order';
import {
  SiteCategory, SiteEnquiry, SiteMedia, SitePage, SitePost, SiteProduct, SiteReview, SiteSubscriber, getSiteSettings,
} from './site.models';
import {
  categoriesWithCounts, categoryDto, mediaUrl, pageDto, postDto, productDto, queryProducts, recomputeRating, removeSiteMedia,
  reviewDto, settingsDto, storeSiteImage, uniqueSlug,
} from './site.service';
import { importWooCommerceCsv, localizeRemoteImages } from './site.import';
import {
  categorySchema, enquiryUpdateSchema, pageSchema, postSchema, productPatchSchema, productSchema, reviewUpdateSchema, siteSettingsSchema,
} from './site.validation';

const router = Router();
const view = requirePermission('site.view');
const manage = requirePermission('site.manage');
const enquiries = requirePermission('site.enquiries');

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 20 },
  fileFilter: (_req, file, cb) => {
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif'].includes(file.mimetype)) { cb(badRequest('Upload PNG, JPG, WEBP, GIF or AVIF images')); return; }
    cb(null, true);
  },
});

const importUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 40 * 1024 * 1024, files: 6 },
  fileFilter: (_req, file, cb) => {
    if (!/\.(csv|xml)$/i.test(file.originalname)) { cb(badRequest('Upload the WooCommerce CSV export (and optionally product sitemap .xml files)')); return; }
    cb(null, true);
  },
});

const idParam = (value: unknown, what: string) => assertObjectId(typeof value === 'string' ? value : '', what);

// ---------- overview ----------

router.get('/overview', view, async (_req, res) => {
  const [products, drafts, categories, pages, posts, newEnquiries, pendingReviews, subscribers, websiteOrders, openWebsiteOrders] = await Promise.all([
    SiteProduct.countDocuments({ published: true }),
    SiteProduct.countDocuments({ published: false }),
    SiteCategory.countDocuments(),
    SitePage.countDocuments(),
    SitePost.countDocuments(),
    SiteEnquiry.countDocuments({ status: 'new' }),
    SiteReview.countDocuments({ status: 'pending' }),
    SiteSubscriber.countDocuments({ active: true }),
    Order.countDocuments({ source: 'website' }),
    Order.countDocuments({ source: 'website', stage: { $ne: 'delivered' } }),
  ]);
  const [recentOrders, recentEnquiries, remoteImages] = await Promise.all([
    Order.find({ source: 'website' }).sort({ createdAt: -1 }).limit(6).populate('customer', 'name').lean(),
    SiteEnquiry.find().sort({ createdAt: -1 }).limit(6).lean(),
    SiteProduct.countDocuments({ images: { $elemMatch: { $regex: '^https?://' } } }),
  ]);
  res.json({
    counts: { products, drafts, categories, pages, posts, newEnquiries, pendingReviews, subscribers, websiteOrders, openWebsiteOrders, remoteImages },
    recentOrders: recentOrders.map((o) => ({ id: String(o._id), orderNo: o.orderNo, customer: (o.customer as unknown as { name?: string })?.name ?? '', productName: o.productName, quantity: o.quantity, totalAmount: o.totalAmount, stage: o.stage, createdAt: (o as unknown as { createdAt: Date }).createdAt })),
    recentEnquiries: recentEnquiries.map((e) => ({ id: String(e._id), type: e.type, name: e.name, status: e.status, createdAt: e.createdAt })),
  });
});

// ---------- settings ----------

router.get('/settings', view, async (_req, res) => {
  res.json({ settings: settingsDto(await getSiteSettings()) });
});

router.put('/settings', manage, async (req, res) => {
  const me = currentUser(req);
  const body = parse(siteSettingsSchema, req.body);
  const settings = await getSiteSettings();
  settings.set(body);
  await settings.save();
  await audit(me, 'site.settings.updated', 'SiteSettings', 'site', 'Updated website settings');
  res.json({ settings: settingsDto(settings) });
});

// ---------- media ----------

router.get('/media', view, async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 60);
  const [items, total] = await Promise.all([SiteMedia.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SiteMedia.countDocuments()]);
  res.json({ media: items.map((m) => ({ id: String(m._id), url: mediaUrl(m.storedName), originalName: m.originalName, size: m.size, createdAt: m.createdAt })), total, page, limit });
});

router.post('/media', manage, imageUpload.array('files', 20), async (req, res) => {
  const me = currentUser(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!files.length) throw badRequest('Choose at least one image');
  const stored = [];
  for (const f of files) {
    try { stored.push(await storeSiteImage(f.buffer, f.originalname, me.id)); } catch { throw badRequest(`${f.originalname} could not be read as an image`); }
  }
  res.status(201).json({ media: stored.map((s) => ({ url: s.url, size: s.size })) });
});

router.delete('/media/:id', manage, async (req, res) => {
  const media = await SiteMedia.findById(idParam(req.params.id, 'Image')).lean();
  if (!media) throw notFound('Image not found');
  await removeSiteMedia(media.storedName);
  res.json({ ok: true });
});

// ---------- categories ----------

router.get('/categories', view, async (_req, res) => {
  res.json({ categories: await categoriesWithCounts(false) });
});

async function validateParent(parent: string | null | undefined, selfId?: string) {
  if (!parent) return null;
  if (parent === selfId) throw badRequest('parent: A category cannot be its own parent');
  const all = await SiteCategory.find().select('_id parent').lean();
  const parentOf = new Map(all.map((c) => [String(c._id), c.parent ? String(c.parent) : null]));
  if (!parentOf.has(parent)) throw badRequest('parent: Parent category not found');
  for (let cur: string | null | undefined = parent; cur; cur = parentOf.get(cur)) if (cur === selfId) throw badRequest('parent: That would create a loop');
  return parent;
}

router.post('/categories', manage, async (req, res) => {
  const me = currentUser(req);
  const body = parse(categorySchema, req.body);
  const parent = await validateParent(body.parent || null);
  const category = await SiteCategory.create({ ...body, parent, slug: await uniqueSlug(SiteCategory, body.slug || body.name) });
  await audit(me, 'site.category.created', 'SiteCategory', String(category._id), `Created category ${category.name}`);
  res.status(201).json({ category: categoryDto(category.toObject()) });
});

router.put('/categories/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Category');
  const body = parse(categorySchema, req.body);
  const parent = await validateParent(body.parent || null, id);
  const category = await SiteCategory.findByIdAndUpdate(id, { ...body, parent, slug: await uniqueSlug(SiteCategory, body.slug || body.name, id) }, { returnDocument: 'after', runValidators: true }).lean();
  if (!category) throw notFound('Category not found');
  await audit(me, 'site.category.updated', 'SiteCategory', id, `Updated category ${category.name}`);
  res.json({ category: categoryDto(category) });
});

router.delete('/categories/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Category');
  const category = await SiteCategory.findByIdAndDelete(id).lean();
  if (!category) throw notFound('Category not found');
  // Children move up one level and products simply lose the category.
  await SiteCategory.updateMany({ parent: id }, { parent: category.parent ?? null });
  await SiteProduct.updateMany({ categories: id }, { $pull: { categories: new Types.ObjectId(id) } });
  await audit(me, 'site.category.deleted', 'SiteCategory', id, `Deleted category ${category.name}`);
  res.json({ ok: true });
});

// ---------- products ----------

router.get('/products', view, async (req, res) => {
  res.json(await queryProducts({ sort: 'latest', limit: 50, ...req.query } as Record<string, unknown>, { admin: true }));
});

router.get('/products/:id', view, async (req, res) => {
  const product = await SiteProduct.findById(idParam(req.params.id, 'Product')).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  res.json({ product: productDto(product, { admin: true }) });
});

async function assertCategories(ids: string[]) {
  if (!ids.length) return;
  const found = await SiteCategory.countDocuments({ _id: { $in: ids } });
  if (found !== new Set(ids).size) throw badRequest('categories: One or more categories no longer exist');
}

router.post('/products', manage, async (req, res) => {
  const me = currentUser(req);
  const body = parse(productSchema, req.body);
  await assertCategories(body.categories);
  const product = await SiteProduct.create({ ...body, slug: await uniqueSlug(SiteProduct, body.slug || body.name) });
  await audit(me, 'site.product.created', 'SiteProduct', String(product._id), `Created product ${product.name}`);
  res.status(201).json({ product: productDto(product.toObject(), { admin: true }) });
});

router.put('/products/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Product');
  const body = parse(productSchema, req.body);
  await assertCategories(body.categories);
  const product = await SiteProduct.findByIdAndUpdate(id, { ...body, slug: await uniqueSlug(SiteProduct, body.slug || body.name, id) }, { returnDocument: 'after', runValidators: true }).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  await audit(me, 'site.product.updated', 'SiteProduct', id, `Updated product ${product.name}`);
  res.json({ product: productDto(product, { admin: true }) });
});

router.patch('/products/:id', manage, async (req, res) => {
  const id = idParam(req.params.id, 'Product');
  const body = parse(productPatchSchema, req.body);
  const product = await SiteProduct.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true }).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  res.json({ product: productDto(product, { admin: true }) });
});

router.delete('/products/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Product');
  const product = await SiteProduct.findByIdAndDelete(id).lean();
  if (!product) throw notFound('Product not found');
  await SiteReview.deleteMany({ product: id });
  await audit(me, 'site.product.deleted', 'SiteProduct', id, `Deleted product ${product.name}`);
  res.json({ ok: true });
});

router.post('/products/import', manage, importUpload.array('files', 6), async (req, res) => {
  const me = currentUser(req);
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  const csv = files.find((f) => /\.csv$/i.test(f.originalname));
  if (!csv) throw badRequest('Choose the WooCommerce product export (.csv)');
  const sitemaps = files.filter((f) => /\.xml$/i.test(f.originalname)).map((f) => f.buffer.toString('utf8'));
  let summary;
  try { summary = await importWooCommerceCsv(csv.buffer.toString('utf8'), sitemaps); } catch (error) { throw badRequest((error as Error).message); }
  await audit(me, 'site.products.imported', 'SiteProduct', 'import', `Imported products from WooCommerce: ${summary.created} created, ${summary.updated} updated`);
  res.json({ summary });
});

router.post('/products/localize-images', manage, async (req, res) => {
  const me = currentUser(req);
  const limit = Math.min(20, Math.max(1, Number(req.query.limit) || 5));
  res.json(await localizeRemoteImages(limit, me.id));
});

// ---------- pages & posts ----------

router.get('/pages', view, async (_req, res) => {
  const pages = await SitePage.find().sort({ title: 1 }).lean();
  res.json({ pages: pages.map(pageDto) });
});

router.post('/pages', manage, async (req, res) => {
  const me = currentUser(req);
  const body = parse(pageSchema, req.body);
  const page = await SitePage.create({ ...body, slug: await uniqueSlug(SitePage, body.slug || body.title) });
  await audit(me, 'site.page.created', 'SitePage', String(page._id), `Created page ${page.title}`);
  res.status(201).json({ page: pageDto(page.toObject()) });
});

router.put('/pages/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Page');
  const body = parse(pageSchema, req.body);
  const page = await SitePage.findByIdAndUpdate(id, { ...body, slug: await uniqueSlug(SitePage, body.slug || body.title, id) }, { returnDocument: 'after', runValidators: true }).lean();
  if (!page) throw notFound('Page not found');
  await audit(me, 'site.page.updated', 'SitePage', id, `Updated page ${page.title}`);
  res.json({ page: pageDto(page) });
});

router.delete('/pages/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Page');
  const page = await SitePage.findByIdAndDelete(id).lean();
  if (!page) throw notFound('Page not found');
  await audit(me, 'site.page.deleted', 'SitePage', id, `Deleted page ${page.title}`);
  res.json({ ok: true });
});

router.get('/posts', view, async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 50);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.search === 'string' && req.query.search.trim()) filter.title = { $regex: escapeRegex(req.query.search.trim()), $options: 'i' };
  const [posts, total] = await Promise.all([SitePost.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(), SitePost.countDocuments(filter)]);
  res.json({ posts: posts.map((p) => postDto(p)), total, page, limit });
});

router.post('/posts', manage, async (req, res) => {
  const me = currentUser(req);
  const body = parse(postSchema, req.body);
  const post = await SitePost.create({ ...body, publishedAt: body.publishedAt ?? new Date(), slug: await uniqueSlug(SitePost, body.slug || body.title) });
  await audit(me, 'site.post.created', 'SitePost', String(post._id), `Created blog post ${post.title}`);
  res.status(201).json({ post: postDto(post.toObject()) });
});

router.put('/posts/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Post');
  const body = parse(postSchema, req.body);
  const post = await SitePost.findByIdAndUpdate(id, { ...body, slug: await uniqueSlug(SitePost, body.slug || body.title, id) }, { returnDocument: 'after', runValidators: true }).lean();
  if (!post) throw notFound('Post not found');
  await audit(me, 'site.post.updated', 'SitePost', id, `Updated blog post ${post.title}`);
  res.json({ post: postDto(post) });
});

router.delete('/posts/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Post');
  const post = await SitePost.findByIdAndDelete(id).lean();
  if (!post) throw notFound('Post not found');
  await audit(me, 'site.post.deleted', 'SitePost', id, `Deleted blog post ${post.title}`);
  res.json({ ok: true });
});

// ---------- enquiries ----------

const enquiryDto = (e: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  id: String(e._id), type: e.type, name: e.name, email: e.email, phone: e.phone, team: e.team, product: e.product, quantity: e.quantity,
  neededBy: e.neededBy, subject: e.subject, message: e.message, status: e.status, notes: e.notes, createdAt: e.createdAt,
  files: (e.files ?? []).map((f: Record<string, any>) => ({ originalName: f.originalName, size: f.size, mimeType: f.mimeType, url: `/api/site/enquiries/${String(e._id)}/files/${f.storedName}` })), // eslint-disable-line @typescript-eslint/no-explicit-any
});

router.get('/enquiries', enquiries, async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 50);
  const q = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (q.type === 'custom' || q.type === 'contact') filter.type = q.type;
  if (q.status && ['new', 'in_progress', 'closed'].includes(q.status)) filter.status = q.status;
  if (q.search?.trim()) {
    const rx = { $regex: escapeRegex(q.search.trim()), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { team: rx }, { message: rx }];
  }
  const [items, total] = await Promise.all([SiteEnquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SiteEnquiry.countDocuments(filter)]);
  res.json({ enquiries: items.map(enquiryDto), total, page, limit });
});

router.patch('/enquiries/:id', enquiries, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Enquiry');
  const body = parse(enquiryUpdateSchema, req.body);
  const enquiry = await SiteEnquiry.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true }).lean();
  if (!enquiry) throw notFound('Enquiry not found');
  await audit(me, 'site.enquiry.updated', 'SiteEnquiry', id, `Updated enquiry from ${enquiry.name}`);
  res.json({ enquiry: enquiryDto(enquiry) });
});

router.delete('/enquiries/:id', enquiries, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Enquiry');
  const enquiry = await SiteEnquiry.findByIdAndDelete(id).lean();
  if (!enquiry) throw notFound('Enquiry not found');
  for (const f of enquiry.files ?? []) fs.promises.unlink(storedFilePath(f.storedName)).catch(() => undefined);
  await audit(me, 'site.enquiry.deleted', 'SiteEnquiry', id, `Deleted enquiry from ${enquiry.name}`);
  res.json({ ok: true });
});

router.get('/enquiries/:id/files/:storedName', enquiries, async (req, res) => {
  const enquiry = await SiteEnquiry.findById(idParam(req.params.id, 'Enquiry')).lean();
  const storedName = path.basename(String(req.params.storedName));
  const file = enquiry?.files.find((f) => f.storedName === storedName);
  if (!file) throw notFound('File not found');
  const inline = isInlineSafe(file.mimeType);
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
  res.set('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename="${encodeURIComponent(file.originalName)}"`);
  res.type(inline ? file.mimeType : 'application/octet-stream').sendFile(storedFilePath(storedName), (err) => { if (err && !res.headersSent) res.status(404).end(); });
});

// ---------- reviews ----------

router.get('/reviews', view, async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 50);
  const status = typeof req.query.status === 'string' && ['pending', 'approved', 'rejected'].includes(req.query.status) ? req.query.status : undefined;
  const filter: Record<string, unknown> = status ? { status } : {};
  const [items, total] = await Promise.all([
    SiteReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('product', 'name slug').lean(),
    SiteReview.countDocuments(filter),
  ]);
  res.json({ reviews: items.map((r) => reviewDto(r, { admin: true })), total, page, limit });
});

router.patch('/reviews/:id', manage, async (req, res) => {
  const me = currentUser(req);
  const id = idParam(req.params.id, 'Review');
  const { status } = parse(reviewUpdateSchema, req.body);
  const review = await SiteReview.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).populate('product', 'name slug').lean();
  if (!review) throw notFound('Review not found');
  await recomputeRating((review.product as unknown as { _id: Types.ObjectId })._id);
  await audit(me, 'site.review.updated', 'SiteReview', id, `Marked review by ${review.name} as ${status}`);
  res.json({ review: reviewDto(review, { admin: true }) });
});

router.delete('/reviews/:id', manage, async (req, res) => {
  const id = idParam(req.params.id, 'Review');
  const review = await SiteReview.findByIdAndDelete(id).lean();
  if (!review) throw notFound('Review not found');
  await recomputeRating(review.product);
  res.json({ ok: true });
});

// ---------- subscribers ----------

router.get('/subscribers', view, async (req, res) => {
  const { page, limit, skip } = pagination(req.query as Record<string, unknown>, 100);
  const filter: Record<string, unknown> = {};
  if (typeof req.query.search === 'string' && req.query.search.trim()) filter.email = { $regex: escapeRegex(req.query.search.trim()), $options: 'i' };
  const [items, total] = await Promise.all([SiteSubscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SiteSubscriber.countDocuments(filter)]);
  res.json({ subscribers: items.map((s) => ({ id: String(s._id), email: s.email, active: s.active, source: s.source, createdAt: s.createdAt })), total, page, limit });
});

router.get('/subscribers/export', view, async (_req, res) => {
  const items = await SiteSubscriber.find({ active: true }).sort({ createdAt: 1 }).lean();
  const csv = ['email,subscribed_at', ...items.map((s) => `"${s.email.replace(/"/g, '""')}",${s.createdAt.toISOString()}`)].join('\n');
  res.set('Content-Disposition', 'attachment; filename="sns-subscribers.csv"');
  res.type('text/csv').send(csv);
});

router.delete('/subscribers/:id', manage, async (req, res) => {
  const deleted = await SiteSubscriber.findByIdAndDelete(idParam(req.params.id, 'Subscriber')).lean();
  if (!deleted) throw notFound('Subscriber not found');
  res.json({ ok: true });
});

export default router;
