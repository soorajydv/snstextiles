import path from 'path';
import { badRequest, notFound, parse } from '../../lib/http';
import { compressUploadedImage, removeUploadedFiles, storedFilePath } from '../../lib/uploads';
import type { AuthUser } from '../../middleware/auth';
import {
  SiteEnquiry, SiteMedia, SitePage, SitePost, SiteProduct, SiteReview, SiteSubscriber, getSiteSettings,
} from './site.model';
import {
  categoriesWithCounts, effectivePrice, notifyNewEnquiry, pageDto, placeWebsiteOrders, postDto, productDto, queryProducts,
  reviewDto, settingsDto,
} from './site.service';
import { checkoutSchema, type EnquiryInput, type ReviewInput } from './site.validation';

// ---------- site shell ----------

export async function getSiteShell() {
  const [settings, categories, footerPages] = await Promise.all([
    getSiteSettings(),
    categoriesWithCounts(true),
    SitePage.find({ published: true, showInFooter: true }).select('title slug').sort({ title: 1 }).lean(),
  ]);
  return { settings: settingsDto(settings), categories, footerPages: footerPages.map((p) => ({ title: p.title, slug: p.slug })) };
}

/** A public website image by its stored file name. */
export async function getPublicMedia(rawStoredName: string) {
  const storedName = path.basename(rawStoredName);
  const media = await SiteMedia.findOne({ storedName }).lean();
  if (!media) throw notFound('Image not found');
  return { mimeType: media.mimeType, path: storedFilePath(storedName) };
}

// ---------- catalogue ----------

export async function listPublicCategories() {
  return { categories: await categoriesWithCounts(true) };
}

export async function listPublicProducts(query: Record<string, unknown>) {
  return queryProducts(query);
}

export async function getPublicProduct(slug: string) {
  const product = await SiteProduct.findOne({ slug: slug.toLowerCase(), published: true }).populate('categories', 'name slug').lean();
  if (!product) throw notFound('Product not found');
  const categoryIds = (product.categories as unknown as { _id: unknown }[]).map((c) => c._id);
  const relatedFilter: Record<string, unknown> = { _id: { $ne: product._id }, published: true };
  if (categoryIds.length) relatedFilter.categories = { $in: categoryIds };
  let [related, reviews] = await Promise.all([
    SiteProduct.find(relatedFilter)
      .sort({ featured: -1, salesCount: -1, createdAt: -1 }).limit(8).populate('categories', 'name slug').lean(),
    SiteReview.find({ product: product._id, status: 'approved' }).sort({ createdAt: -1 }).limit(50).lean(),
  ]);
  if (!related.length && categoryIds.length) {
    related = await SiteProduct.find({ _id: { $ne: product._id }, published: true })
      .sort({ featured: -1, salesCount: -1, createdAt: -1 }).limit(8).populate('categories', 'name slug').lean();
  }
  return { product: productDto(product), related: related.map((p) => productDto(p)), reviews: reviews.map((r) => reviewDto(r)) };
}

/** Current prices for the cart page (the server always re-prices at checkout). */
export async function getCartPrices(rawIds: unknown) {
  const ids = Array.isArray(rawIds) ? (rawIds as unknown[]).filter((v): v is string => typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v)).slice(0, 50) : [];
  const products = await SiteProduct.find({ _id: { $in: ids } }).lean();
  return {
    products: products.map((p) => ({
      id: String(p._id), slug: p.slug, name: p.name, image: p.images[0] ?? '', price: effectivePrice(p),
      available: p.published && p.stockStatus !== 'out_of_stock', minQuantity: p.minQuantity, sizes: p.sizes, allowDesignUpload: p.allowDesignUpload !== false,
    })),
  };
}

// ---------- content ----------

export async function getPublicPage(slug: string) {
  const page = await SitePage.findOne({ slug: slug.toLowerCase(), published: true }).lean();
  if (!page) throw notFound('Page not found');
  return { page: pageDto(page) };
}

export async function listPublicPosts(query: Record<string, unknown>) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(48, Math.max(1, Number(query.limit) || 9));
  const filter = { published: true, publishedAt: { $lte: new Date() } };
  const [posts, total] = await Promise.all([
    SitePost.find(filter).sort({ publishedAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    SitePost.countDocuments(filter),
  ]);
  return { posts: posts.map((p) => postDto(p, false)), total, page, limit };
}

export async function getPublicPost(slug: string) {
  const post = await SitePost.findOne({ slug: slug.toLowerCase(), published: true, publishedAt: { $lte: new Date() } }).lean();
  if (!post) throw notFound('Post not found');
  const more = await SitePost.find({ _id: { $ne: post._id }, published: true, publishedAt: { $lte: new Date() } }).sort({ publishedAt: -1 }).limit(3).lean();
  return { post: postDto(post), more: more.map((p) => postDto(p, false)) };
}

/** Everything the sitemap needs in one call. */
export async function getSitemap() {
  const [products, pages, posts, categories] = await Promise.all([
    SiteProduct.find({ published: true }).select('slug updatedAt').lean(),
    SitePage.find({ published: true }).select('slug updatedAt').lean(),
    SitePost.find({ published: true, publishedAt: { $lte: new Date() } }).select('slug updatedAt').lean(),
    categoriesWithCounts(true),
  ]);
  return {
    products: products.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    pages: pages.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    posts: posts.map((p) => ({ slug: p.slug, updatedAt: p.updatedAt })),
    categories: categories.map((c) => ({ slug: c.slug })),
  };
}

// ---------- forms ----------

export async function createEnquiry(body: EnquiryInput, files: Express.Multer.File[]) {
  await Promise.all(files.map(compressUploadedImage));
  const enquiry = await SiteEnquiry.create({
    type: body.type, name: body.name, email: body.email, phone: body.phone, team: body.team, product: body.product,
    quantity: body.quantity ?? null, neededBy: body.neededBy ?? null, subject: body.subject, message: body.message,
    files: files.map((f) => ({ storedName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size })),
  });
  void notifyNewEnquiry({ type: enquiry.type, name: enquiry.name, email: enquiry.email, phone: enquiry.phone, message: enquiry.message, product: enquiry.product, team: enquiry.team });
  return { ok: true };
}

export async function createReview(body: ReviewInput) {
  if (!(await SiteProduct.exists({ _id: body.productId, published: true }))) throw notFound('Product not found');
  await SiteReview.create({ product: body.productId, name: body.name, email: body.email, rating: body.rating, body: body.body, status: 'pending' });
  return { ok: true, message: 'Thank you! Your review will appear once it has been approved.' };
}

export async function subscribe(email: string) {
  await SiteSubscriber.updateOne({ email: email.toLowerCase() }, { $set: { active: true }, $setOnInsert: { source: 'website' } }, { upsert: true });
  return { ok: true };
}

// ---------- checkout (signed-in customers) ----------

const ALLOWED_CHECKOUT_FIELDS = /^(design_\d{1,2}|advanceProof)$/;

/**
 * Validates the uploaded files and cart, then places the orders; unused uploads are removed.
 * `readData` is only called after the file checks so error precedence matches the request order.
 */
export async function checkout(user: AuthUser, readData: () => unknown, files: Express.Multer.File[]) {
  if (files.some((f) => !ALLOWED_CHECKOUT_FIELDS.test(f.fieldname))) throw badRequest('Unexpected file upload');
  if (files.filter((f) => f.fieldname === 'advanceProof').length > 1) throw badRequest('advanceProof: Upload one payment screenshot');
  await Promise.all(files.map(compressUploadedImage));
  const input = parse(checkoutSchema, readData());
  const result = await placeWebsiteOrders(user, input, files);
  // Remove uploads that did not end up on an order (e.g. files for an index that does not exist).
  const itemCount = input.items.length;
  removeUploadedFiles(files.filter((f) => f.fieldname.startsWith('design_') && Number(f.fieldname.slice(7)) >= itemCount));
  return result;
}
