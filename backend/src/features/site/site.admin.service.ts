import fs from 'fs';
import path from 'path';
import { Types } from 'mongoose';
import { audit } from '../audit/audit.service';
import { badRequest, escapeRegex, notFound, pagination } from '../../lib/http';
import { isInlineSafe, storedFilePath } from '../../lib/uploads';
import type { AuthUser } from '../../middleware/auth';
import { Order } from '../orders/order.model';
import {
  SiteCategory, SiteEnquiry, SiteMedia, SitePage, SitePost, SiteProduct, SiteReview, SiteSubscriber, getSiteSettings,
} from './site.model';
import {
  categoriesWithCounts, categoryDto, mediaUrl, pageDto, postDto, productDto, queryProducts, recomputeRating, removeSiteMedia,
  reviewDto, settingsDto, storeSiteImage, uniqueSlug,
} from './site.service';
import { importWooCommerceCsv, localizeRemoteImages } from './site.import';
import type {
  CategoryInput, EnquiryUpdateInput, PageInput, PostInput, ProductInput, ProductPatchInput, ReviewUpdateInput, SiteSettingsInput,
} from './site.validation';

// ---------- overview ----------

export async function getOverview() {
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
  return {
    counts: { products, drafts, categories, pages, posts, newEnquiries, pendingReviews, subscribers, websiteOrders, openWebsiteOrders, remoteImages },
    recentOrders: recentOrders.map((o) => ({ id: String(o._id), orderNo: o.orderNo, customer: (o.customer as unknown as { name?: string })?.name ?? '', productName: o.productName, quantity: o.quantity, totalAmount: o.totalAmount, stage: o.stage, createdAt: (o as unknown as { createdAt: Date }).createdAt })),
    recentEnquiries: recentEnquiries.map((e) => ({ id: String(e._id), type: e.type, name: e.name, status: e.status, createdAt: e.createdAt })),
  };
}

// ---------- settings ----------

export async function getAdminSettings() {
  return { settings: settingsDto(await getSiteSettings()) };
}

export async function updateSiteSettings(me: AuthUser, body: SiteSettingsInput) {
  const settings = await getSiteSettings();
  settings.set(body);
  await settings.save();
  await audit(me, 'site.settings.updated', 'SiteSettings', 'site', 'Updated website settings');
  return { settings: settingsDto(settings) };
}

// ---------- media ----------

export async function listMedia(query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, 60);
  const [items, total] = await Promise.all([SiteMedia.find().sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SiteMedia.countDocuments()]);
  return { media: items.map((m) => ({ id: String(m._id), url: mediaUrl(m.storedName), originalName: m.originalName, size: m.size, createdAt: m.createdAt })), total, page, limit };
}

export async function uploadMedia(me: AuthUser, files: Express.Multer.File[]) {
  if (!files.length) throw badRequest('Choose at least one image');
  const stored = [];
  for (const f of files) {
    try { stored.push(await storeSiteImage(f.buffer, f.originalname, me.id)); } catch { throw badRequest(`${f.originalname} could not be read as an image`); }
  }
  return { media: stored.map((s) => ({ url: s.url, size: s.size })) };
}

export async function deleteMedia(id: string) {
  const media = await SiteMedia.findById(id).lean();
  if (!media) throw notFound('Image not found');
  await removeSiteMedia(media.storedName);
  return { ok: true };
}

// ---------- categories ----------

export async function listAdminCategories() {
  return { categories: await categoriesWithCounts(false) };
}

async function validateParent(parent: string | null | undefined, selfId?: string) {
  if (!parent) return null;
  if (parent === selfId) throw badRequest('parent: A category cannot be its own parent');
  const all = await SiteCategory.find().select('_id parent').lean();
  const parentOf = new Map(all.map((c) => [String(c._id), c.parent ? String(c.parent) : null]));
  if (!parentOf.has(parent)) throw badRequest('parent: Parent category not found');
  for (let cur: string | null | undefined = parent; cur; cur = parentOf.get(cur)) if (cur === selfId) throw badRequest('parent: That would create a loop');
  return parent;
}

export async function createCategory(me: AuthUser, body: CategoryInput) {
  const parent = await validateParent(body.parent || null);
  const category = await SiteCategory.create({ ...body, parent, slug: await uniqueSlug(SiteCategory, body.slug || body.name) });
  await audit(me, 'site.category.created', 'SiteCategory', String(category._id), `Created category ${category.name}`);
  return { category: categoryDto(category.toObject()) };
}

export async function updateCategory(me: AuthUser, id: string, body: CategoryInput) {
  const parent = await validateParent(body.parent || null, id);
  const category = await SiteCategory.findByIdAndUpdate(id, { ...body, parent, slug: await uniqueSlug(SiteCategory, body.slug || body.name, id) }, { returnDocument: 'after', runValidators: true }).lean();
  if (!category) throw notFound('Category not found');
  await audit(me, 'site.category.updated', 'SiteCategory', id, `Updated category ${category.name}`);
  return { category: categoryDto(category) };
}

export async function deleteCategory(me: AuthUser, id: string) {
  const category = await SiteCategory.findByIdAndDelete(id).lean();
  if (!category) throw notFound('Category not found');
  // Children move up one level and products simply lose the category.
  await SiteCategory.updateMany({ parent: id }, { parent: category.parent ?? null });
  await SiteProduct.updateMany({ categories: id }, { $pull: { categories: new Types.ObjectId(id) } });
  await audit(me, 'site.category.deleted', 'SiteCategory', id, `Deleted category ${category.name}`);
  return { ok: true };
}

// ---------- products ----------

export async function listAdminProducts(query: Record<string, unknown>) {
  return queryProducts({ sort: 'latest', limit: 50, ...query } as Record<string, unknown>, { admin: true });
}

export async function getAdminProduct(id: string) {
  const product = await SiteProduct.findById(id).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  return { product: productDto(product, { admin: true }) };
}

async function assertCategories(ids: string[]) {
  if (!ids.length) return;
  const found = await SiteCategory.countDocuments({ _id: { $in: ids } });
  if (found !== new Set(ids).size) throw badRequest('categories: One or more categories no longer exist');
}

export async function createProduct(me: AuthUser, body: ProductInput) {
  await assertCategories(body.categories);
  const product = await SiteProduct.create({ ...body, slug: await uniqueSlug(SiteProduct, body.slug || body.name) });
  await audit(me, 'site.product.created', 'SiteProduct', String(product._id), `Created product ${product.name}`);
  return { product: productDto(product.toObject(), { admin: true }) };
}

export async function updateProduct(me: AuthUser, id: string, body: ProductInput) {
  await assertCategories(body.categories);
  const product = await SiteProduct.findByIdAndUpdate(id, { ...body, slug: await uniqueSlug(SiteProduct, body.slug || body.name, id) }, { returnDocument: 'after', runValidators: true }).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  await audit(me, 'site.product.updated', 'SiteProduct', id, `Updated product ${product.name}`);
  return { product: productDto(product, { admin: true }) };
}

export async function patchProduct(id: string, body: ProductPatchInput) {
  const product = await SiteProduct.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true }).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  return { product: productDto(product, { admin: true }) };
}

export async function deleteProduct(me: AuthUser, id: string) {
  const product = await SiteProduct.findByIdAndDelete(id).lean();
  if (!product) throw notFound('Product not found');
  await SiteReview.deleteMany({ product: id });
  await audit(me, 'site.product.deleted', 'SiteProduct', id, `Deleted product ${product.name}`);
  return { ok: true };
}

export async function importProducts(me: AuthUser, files: Express.Multer.File[]) {
  const csv = files.find((f) => /\.csv$/i.test(f.originalname));
  if (!csv) throw badRequest('Choose the WooCommerce product export (.csv)');
  const sitemaps = files.filter((f) => /\.xml$/i.test(f.originalname)).map((f) => f.buffer.toString('utf8'));
  let summary;
  try { summary = await importWooCommerceCsv(csv.buffer.toString('utf8'), sitemaps); } catch (error) { throw badRequest((error as Error).message); }
  await audit(me, 'site.products.imported', 'SiteProduct', 'import', `Imported products from WooCommerce: ${summary.created} created, ${summary.updated} updated`);
  return { summary };
}

export async function localizeImages(me: AuthUser, limitParam: unknown) {
  const limit = Math.min(20, Math.max(1, Number(limitParam) || 5));
  return localizeRemoteImages(limit, me.id);
}

// ---------- pages & posts ----------

export async function listAdminPages() {
  const pages = await SitePage.find().sort({ title: 1 }).lean();
  return { pages: pages.map(pageDto) };
}

export async function createPage(me: AuthUser, body: PageInput) {
  const page = await SitePage.create({ ...body, slug: await uniqueSlug(SitePage, body.slug || body.title) });
  await audit(me, 'site.page.created', 'SitePage', String(page._id), `Created page ${page.title}`);
  return { page: pageDto(page.toObject()) };
}

export async function updatePage(me: AuthUser, id: string, body: PageInput) {
  const page = await SitePage.findByIdAndUpdate(id, { ...body, slug: await uniqueSlug(SitePage, body.slug || body.title, id) }, { returnDocument: 'after', runValidators: true }).lean();
  if (!page) throw notFound('Page not found');
  await audit(me, 'site.page.updated', 'SitePage', id, `Updated page ${page.title}`);
  return { page: pageDto(page) };
}

export async function deletePage(me: AuthUser, id: string) {
  const page = await SitePage.findByIdAndDelete(id).lean();
  if (!page) throw notFound('Page not found');
  await audit(me, 'site.page.deleted', 'SitePage', id, `Deleted page ${page.title}`);
  return { ok: true };
}

export async function listAdminPosts(query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, 50);
  const filter: Record<string, unknown> = {};
  if (typeof query.search === 'string' && query.search.trim()) filter.title = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
  const [posts, total] = await Promise.all([SitePost.find(filter).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(), SitePost.countDocuments(filter)]);
  return { posts: posts.map((p) => postDto(p)), total, page, limit };
}

export async function createPost(me: AuthUser, body: PostInput) {
  const post = await SitePost.create({ ...body, publishedAt: body.publishedAt ?? new Date(), slug: await uniqueSlug(SitePost, body.slug || body.title) });
  await audit(me, 'site.post.created', 'SitePost', String(post._id), `Created blog post ${post.title}`);
  return { post: postDto(post.toObject()) };
}

export async function updatePost(me: AuthUser, id: string, body: PostInput) {
  const post = await SitePost.findByIdAndUpdate(id, { ...body, slug: await uniqueSlug(SitePost, body.slug || body.title, id) }, { returnDocument: 'after', runValidators: true }).lean();
  if (!post) throw notFound('Post not found');
  await audit(me, 'site.post.updated', 'SitePost', id, `Updated blog post ${post.title}`);
  return { post: postDto(post) };
}

export async function deletePost(me: AuthUser, id: string) {
  const post = await SitePost.findByIdAndDelete(id).lean();
  if (!post) throw notFound('Post not found');
  await audit(me, 'site.post.deleted', 'SitePost', id, `Deleted blog post ${post.title}`);
  return { ok: true };
}

// ---------- enquiries ----------

const enquiryDto = (e: Record<string, any>) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
  id: String(e._id), type: e.type, name: e.name, email: e.email, phone: e.phone, team: e.team, product: e.product, quantity: e.quantity,
  neededBy: e.neededBy, subject: e.subject, message: e.message, status: e.status, notes: e.notes, createdAt: e.createdAt,
  files: (e.files ?? []).map((f: Record<string, any>) => ({ originalName: f.originalName, size: f.size, mimeType: f.mimeType, url: `/api/site/enquiries/${String(e._id)}/files/${f.storedName}` })), // eslint-disable-line @typescript-eslint/no-explicit-any
});

export async function listEnquiries(query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, 50);
  const q = query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = {};
  if (q.type === 'custom' || q.type === 'contact') filter.type = q.type;
  if (q.status && ['new', 'in_progress', 'closed'].includes(q.status)) filter.status = q.status;
  if (q.search?.trim()) {
    const rx = { $regex: escapeRegex(q.search.trim()), $options: 'i' };
    filter.$or = [{ name: rx }, { email: rx }, { phone: rx }, { team: rx }, { message: rx }];
  }
  const [items, total] = await Promise.all([SiteEnquiry.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SiteEnquiry.countDocuments(filter)]);
  return { enquiries: items.map(enquiryDto), total, page, limit };
}

export async function updateEnquiry(me: AuthUser, id: string, body: EnquiryUpdateInput) {
  const enquiry = await SiteEnquiry.findByIdAndUpdate(id, body, { returnDocument: 'after', runValidators: true }).lean();
  if (!enquiry) throw notFound('Enquiry not found');
  await audit(me, 'site.enquiry.updated', 'SiteEnquiry', id, `Updated enquiry from ${enquiry.name}`);
  return { enquiry: enquiryDto(enquiry) };
}

export async function deleteEnquiry(me: AuthUser, id: string) {
  const enquiry = await SiteEnquiry.findByIdAndDelete(id).lean();
  if (!enquiry) throw notFound('Enquiry not found');
  for (const f of enquiry.files ?? []) fs.promises.unlink(storedFilePath(f.storedName)).catch(() => undefined);
  await audit(me, 'site.enquiry.deleted', 'SiteEnquiry', id, `Deleted enquiry from ${enquiry.name}`);
  return { ok: true };
}

/** An enquiry attachment and how it may be served. */
export async function getEnquiryFile(id: string, rawStoredName: string) {
  const enquiry = await SiteEnquiry.findById(id).lean();
  const storedName = path.basename(rawStoredName);
  const file = enquiry?.files.find((f) => f.storedName === storedName);
  if (!file) throw notFound('File not found');
  const inline = isInlineSafe(file.mimeType);
  return { inline, mimeType: file.mimeType, originalName: file.originalName, path: storedFilePath(storedName) };
}

// ---------- reviews ----------

export async function listReviews(query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, 50);
  const status = typeof query.status === 'string' && ['pending', 'approved', 'rejected'].includes(query.status) ? query.status : undefined;
  const filter: Record<string, unknown> = status ? { status } : {};
  const [items, total] = await Promise.all([
    SiteReview.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('product', 'name slug').lean(),
    SiteReview.countDocuments(filter),
  ]);
  return { reviews: items.map((r) => reviewDto(r, { admin: true })), total, page, limit };
}

export async function updateReview(me: AuthUser, id: string, { status }: ReviewUpdateInput) {
  const review = await SiteReview.findByIdAndUpdate(id, { status }, { returnDocument: 'after' }).populate('product', 'name slug').lean();
  if (!review) throw notFound('Review not found');
  await recomputeRating((review.product as unknown as { _id: Types.ObjectId })._id);
  await audit(me, 'site.review.updated', 'SiteReview', id, `Marked review by ${review.name} as ${status}`);
  return { review: reviewDto(review, { admin: true }) };
}

export async function deleteReview(id: string) {
  const review = await SiteReview.findByIdAndDelete(id).lean();
  if (!review) throw notFound('Review not found');
  await recomputeRating(review.product);
  return { ok: true };
}

// ---------- subscribers ----------

export async function listSubscribers(query: Record<string, unknown>) {
  const { page, limit, skip } = pagination(query, 100);
  const filter: Record<string, unknown> = {};
  if (typeof query.search === 'string' && query.search.trim()) filter.email = { $regex: escapeRegex(query.search.trim()), $options: 'i' };
  const [items, total] = await Promise.all([SiteSubscriber.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(), SiteSubscriber.countDocuments(filter)]);
  return { subscribers: items.map((s) => ({ id: String(s._id), email: s.email, active: s.active, source: s.source, createdAt: s.createdAt })), total, page, limit };
}

export async function exportSubscribersCsv() {
  const items = await SiteSubscriber.find({ active: true }).sort({ createdAt: 1 }).lean();
  return ['email,subscribed_at', ...items.map((s) => `"${s.email.replace(/"/g, '""')}",${s.createdAt.toISOString()}`)].join('\n');
}

export async function deleteSubscriber(id: string) {
  const deleted = await SiteSubscriber.findByIdAndDelete(id).lean();
  if (!deleted) throw notFound('Subscriber not found');
  return { ok: true };
}
