import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import type { Model, PipelineStage } from 'mongoose';
import { Types } from 'mongoose';
import { env } from '../../config/env';
import { audit } from '../audit/audit.service';
import { STAGE_LABELS, type Stage } from '../../lib/constants';
import { badRequest, escapeRegex, forbidden, notFound } from '../../lib/http';
import { sendEmail } from '../../lib/mail';
import { storedFilePath } from '../../lib/uploads';
import { computeStatus } from '../orders/order.workflow';
import type { AuthUser } from '../../middleware/auth';
import { nextSequence } from '../../lib/counter';
import { Customer } from '../customers/customer.model';
import { Order } from '../orders/order.model';
import { Payment } from '../payments/payment.model';
import { getSettings } from '../settings/settings.model';
import { User } from '../users/user.model';
import {
  SHOP_SIZES, SiteCategory, SiteMedia, SiteProduct, SiteReview, getSiteSettings,
} from './site.models';
import type { CheckoutInput } from './site.validation';

type Lean = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

// ---------- slugs & media ----------

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

/** Returns `base` or `base-2`, `base-3`… so the slug is unique within the collection. */
export async function uniqueSlug(model: Model<any>, base: string, excludeId?: string) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const root = slugify(base);
  for (let i = 1; i < 500; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const filter: Lean = { slug: candidate };
    if (excludeId) filter._id = { $ne: excludeId };
    if (!(await model.exists(filter))) return candidate;
  }
  return `${root}-${crypto.randomUUID().slice(0, 6)}`;
}

export const MEDIA_PREFIX = '/api/public/site/media/';
export const mediaUrl = (storedName: string) => `${MEDIA_PREFIX}${storedName}`;

/** Normalises and stores a raster image for public use; returns its public URL. */
export async function storeSiteImage(input: Buffer | string, originalName: string, userId: string | null) {
  const storedName = `${crypto.randomUUID()}.webp`;
  const output = storedFilePath(storedName);
  const info = await sharp(input, { failOn: 'error' })
    .rotate()
    .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80, effort: 4 })
    .toFile(output);
  await SiteMedia.create({ storedName, originalName: originalName.slice(0, 200), mimeType: 'image/webp', size: info.size, uploadedBy: userId });
  return { storedName, url: mediaUrl(storedName), size: info.size };
}

export async function removeSiteMedia(urlOrName: string) {
  const storedName = path.basename(urlOrName.startsWith(MEDIA_PREFIX) ? urlOrName.slice(MEDIA_PREFIX.length) : urlOrName);
  const media = await SiteMedia.findOneAndDelete({ storedName });
  if (media) fs.promises.unlink(storedFilePath(storedName)).catch(() => undefined);
}

// ---------- DTOs ----------

const id = (doc: Lean) => String(doc._id);

export function categoryDto(c: Lean, productCount?: number) {
  return {
    id: id(c), name: c.name, slug: c.slug, parent: c.parent ? String(c.parent) : null, description: c.description ?? '',
    image: c.image ?? '', sortOrder: c.sortOrder ?? 0, showOnHome: !!c.showOnHome, published: c.published !== false,
    ...(productCount !== undefined ? { productCount } : {}),
  };
}

export const effectivePrice = (p: Lean) => (typeof p.salePrice === 'number' && p.salePrice < p.price ? p.salePrice : p.price);

export function productDto(p: Lean, opts: { admin?: boolean } = {}) {
  const cats = (p.categories ?? []) as Lean[];
  const base = {
    id: id(p), name: p.name, slug: p.slug, sku: p.sku ?? '', shortDescription: p.shortDescription ?? '', description: p.description ?? '',
    features: p.features ?? [], images: p.images ?? [], tags: p.tags ?? [],
    categories: cats.map((c) => (c && typeof c === 'object' && 'name' in c ? { id: id(c), name: c.name, slug: c.slug } : { id: String(c), name: '', slug: '' })),
    price: p.price, salePrice: typeof p.salePrice === 'number' ? p.salePrice : null, finalPrice: effectivePrice(p),
    productConfig: p.productConfig, neckTypes: p.neckTypes ?? [], sleeves: p.sleeves ?? [], sizes: p.sizes ?? [], colors: p.colors ?? [],
    allowPersonalisation: p.allowPersonalisation !== false, allowDesignUpload: p.allowDesignUpload !== false, minQuantity: p.minQuantity ?? 1,
    stockStatus: p.stockStatus, featured: !!p.featured, ratingAvg: p.ratingAvg ?? 0, ratingCount: p.ratingCount ?? 0,
    seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '', createdAt: p.createdAt,
  };
  if (!opts.admin) return base;
  return { ...base, published: p.published !== false, sortOrder: p.sortOrder ?? 0, salesCount: p.salesCount ?? 0, wooId: p.wooId ?? null, updatedAt: p.updatedAt };
}

export function pageDto(p: Lean) {
  return {
    id: id(p), title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', content: p.content ?? '', published: p.published !== false,
    showInFooter: p.showInFooter !== false, seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '', updatedAt: p.updatedAt,
  };
}

export function postDto(p: Lean, withContent = true) {
  return {
    id: id(p), title: p.title, slug: p.slug, excerpt: p.excerpt ?? '', ...(withContent ? { content: p.content ?? '' } : {}),
    coverImage: p.coverImage ?? '', tags: p.tags ?? [], authorName: p.authorName ?? '', published: p.published !== false,
    publishedAt: p.publishedAt, seoTitle: p.seoTitle ?? '', seoDescription: p.seoDescription ?? '', updatedAt: p.updatedAt,
  };
}

export function reviewDto(r: Lean, opts: { admin?: boolean } = {}) {
  const product = r.product && typeof r.product === 'object' && 'name' in r.product ? { id: id(r.product), name: r.product.name, slug: r.product.slug } : null;
  return {
    id: id(r), name: r.name, rating: r.rating, body: r.body, createdAt: r.createdAt,
    ...(opts.admin ? { email: r.email ?? '', status: r.status, product } : {}),
  };
}

export function settingsDto(s: Lean) {
  const o = typeof s.toObject === 'function' ? s.toObject() : s;
  const { _id, __v, createdAt, ...rest } = o; // eslint-disable-line @typescript-eslint/no-unused-vars
  return rest;
}

// ---------- catalogue queries ----------

/** All category ids under (and including) the given ones. */
export async function withDescendants(ids: Types.ObjectId[]) {
  const all = await SiteCategory.find().select('_id parent').lean();
  const result = new Set(ids.map(String));
  let added = true;
  while (added) {
    added = false;
    for (const c of all) {
      if (c.parent && result.has(String(c.parent)) && !result.has(String(c._id))) { result.add(String(c._id)); added = true; }
    }
  }
  return [...result].map((v) => new Types.ObjectId(v));
}

export const SORTS = ['default', 'popularity', 'rating', 'latest', 'price', 'price-desc'] as const;

export async function queryProducts(q: Record<string, unknown>, opts: { admin?: boolean } = {}) {
  const page = Math.max(1, Number(q.page) || 1);
  const limit = Math.min(96, Math.max(1, Number(q.limit) || 12));
  const match: Lean = {};
  if (!opts.admin) match.published = true;
  else if (q.status === 'published') match.published = true;
  else if (q.status === 'draft') match.published = false;

  if (typeof q.category === 'string' && q.category) {
    const cat = Types.ObjectId.isValid(q.category) && q.category.length === 24
      ? await SiteCategory.findById(q.category).lean()
      : await SiteCategory.findOne({ slug: q.category }).lean();
    if (!cat) return { products: [], total: 0, page, limit, priceRange: { min: 0, max: 0 }, category: null };
    match.categories = { $in: await withDescendants([cat._id]) };
  }
  if (q.uncategorised === '1') match.categories = { $size: 0 };
  if (q.featured === '1') match.featured = true;
  if (typeof q.q === 'string' && q.q.trim()) {
    const rx = { $regex: escapeRegex(q.q.trim().slice(0, 80)), $options: 'i' };
    match.$or = [{ name: rx }, { sku: rx }, { tags: rx }, { shortDescription: rx }];
  }
  if (typeof q.exclude === 'string' && Types.ObjectId.isValid(q.exclude)) match._id = { $ne: new Types.ObjectId(q.exclude) };

  const priceMatch: Lean = {};
  if (q.min !== undefined && q.min !== '' && Number.isFinite(Number(q.min))) priceMatch.$gte = Number(q.min);
  if (q.max !== undefined && q.max !== '' && Number.isFinite(Number(q.max))) priceMatch.$lte = Number(q.max);

  const sortKey = (SORTS as readonly string[]).includes(String(q.sort)) ? String(q.sort) : 'default';
  const sort: Record<string, 1 | -1> = {
    default: { featured: -1, sortOrder: 1, createdAt: -1 },
    popularity: { salesCount: -1, createdAt: -1 },
    rating: { ratingAvg: -1, ratingCount: -1 },
    latest: { createdAt: -1 },
    price: { finalPrice: 1, createdAt: -1 },
    'price-desc': { finalPrice: -1, createdAt: -1 },
  }[sortKey] as Record<string, 1 | -1>;

  const pipeline: PipelineStage[] = [
    { $match: match },
    { $addFields: { finalPrice: { $cond: [{ $and: [{ $ne: ['$salePrice', null] }, { $lt: ['$salePrice', '$price'] }] }, '$salePrice', '$price'] } } },
  ];
  const priceStage = Object.keys(priceMatch).length ? [{ $match: { finalPrice: priceMatch } }] : [];
  const facet = {
    $facet: {
      range: [{ $group: { _id: null, min: { $min: '$finalPrice' }, max: { $max: '$finalPrice' } } }],
      total: [...priceStage, { $count: 'n' }],
      items: [
        ...priceStage,
        { $sort: { ...sort, _id: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        { $lookup: { from: 'sitecategories', localField: 'categories', foreignField: '_id', as: 'categories', pipeline: [{ $project: { name: 1, slug: 1 } }] } },
      ],
    },
  } as PipelineStage;
  const [result] = await SiteProduct.aggregate([...pipeline, facet]);
  return {
    products: ((result?.items ?? []) as Lean[]).map((p) => productDto(p, opts)),
    total: result?.total?.[0]?.n ?? 0,
    page,
    limit,
    priceRange: { min: result?.range?.[0]?.min ?? 0, max: result?.range?.[0]?.max ?? 0 },
  };
}

export async function categoriesWithCounts(onlyPublished: boolean) {
  const categories = await SiteCategory.find(onlyPublished ? { published: true } : {}).sort({ sortOrder: 1, name: 1 }).lean();
  const counts = await SiteProduct.aggregate([
    { $match: onlyPublished ? { published: true } : {} },
    { $unwind: '$categories' },
    { $group: { _id: '$categories', n: { $sum: 1 } } },
  ]);
  const direct = new Map(counts.map((c) => [String(c._id), c.n as number]));
  // Parent categories show the total of their own and their children's products.
  const childrenOf = new Map<string, string[]>();
  for (const c of categories) if (c.parent) childrenOf.set(String(c.parent), [...(childrenOf.get(String(c.parent)) ?? []), String(c._id)]);
  const total = (cid: string, seen = new Set<string>()): number => {
    if (seen.has(cid)) return 0;
    seen.add(cid);
    return (direct.get(cid) ?? 0) + (childrenOf.get(cid) ?? []).reduce((sum, child) => sum + total(child, seen), 0);
  };
  return categories.map((c) => categoryDto(c, total(String(c._id))));
}

export async function recomputeRating(productId: string | Types.ObjectId) {
  const [stats] = await SiteReview.aggregate([
    { $match: { product: new Types.ObjectId(String(productId)), status: 'approved' } },
    { $group: { _id: null, avg: { $avg: '$rating' }, n: { $sum: 1 } } },
  ]);
  await SiteProduct.updateOne({ _id: productId }, { ratingAvg: stats ? Math.round(stats.avg * 10) / 10 : 0, ratingCount: stats?.n ?? 0 });
}

// ---------- checkout ----------

type UploadedFile = Express.Multer.File;


async function copyStoredFile(storedName: string) {
  const copyName = `${crypto.randomUUID()}${path.extname(storedName)}`;
  await fs.promises.copyFile(storedFilePath(storedName), storedFilePath(copyName));
  return copyName;
}

/**
 * Turns a website cart into factory orders: one production order per cart line,
 * priced from the catalogue (never from the client), placed on behalf of the signed-in customer.
 */
export async function placeWebsiteOrders(user: AuthUser, input: CheckoutInput, files: UploadedFile[]) {
  if (user.role !== 'customer' || !user.customerId) throw forbidden('Please sign in with a customer account to place an order');
  const customer = await Customer.findById(user.customerId).lean();
  if (!customer) throw forbidden('Your login is not linked to a customer account');

  const siteSettings = await getSiteSettings();
  // Compare calendar dates in the business time zone; the browser sends a plain YYYY-MM-DD.
  const todayKtm = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kathmandu' }).format(new Date());
  const minDue = new Date(`${todayKtm}T00:00:00Z`);
  minDue.setUTCDate(minDue.getUTCDate() + (siteSettings.checkout?.minLeadDays ?? 0));
  const dueDay = new Date(`${input.dueDate.toISOString().slice(0, 10)}T00:00:00Z`);
  if (dueDay < minDue) throw badRequest(`dueDate: Please choose a date on or after ${minDue.toISOString().slice(0, 10)}`);
  if (!(siteSettings.checkout?.deliveryMethods ?? []).includes(input.shipping.method)) throw badRequest('shipping.method: Choose a delivery option');
  if (/deliver/i.test(input.shipping.method) && input.shipping.address.length < 4) throw badRequest('shipping.address: Enter the delivery address');

  const products = await SiteProduct.find({ _id: { $in: input.items.map((i) => i.productId) }, published: true }).lean();
  const byId = new Map(products.map((p) => [String(p._id), p]));

  const lines = input.items.map((item, index) => {
    const product = byId.get(item.productId);
    if (!product) throw badRequest(`items.${index}: This product is no longer available`);
    if (product.stockStatus === 'out_of_stock') throw badRequest(`items.${index}: ${product.name} is out of stock`);
    const sizes = Object.entries(item.sizes).filter(([size, qty]) => (product.sizes as string[]).includes(size) && (qty ?? 0) > 0) as [string, number][];
    const quantity = sizes.reduce((sum, [, qty]) => sum + qty, 0);
    if (quantity < 1) throw badRequest(`items.${index}: Choose at least one size for ${product.name}`);
    if (quantity < (product.minQuantity ?? 1)) throw badRequest(`items.${index}: ${product.name} has a minimum order of ${product.minQuantity} pieces`);
    if (item.players.length > quantity) throw badRequest(`items.${index}: ${item.players.length} names entered but only ${quantity} pieces ordered`);
    const neckType = item.neckType && product.neckTypes.includes(item.neckType) ? item.neckType : product.neckTypes[0] ?? 'Round neck';
    const sleeve = item.sleeve && product.sleeves.includes(item.sleeve) ? item.sleeve : product.sleeves[0] ?? 'Half sleeve';
    const designFiles = files.filter((f) => f.fieldname === `design_${index}`);
    if (designFiles.length && !product.allowDesignUpload) throw badRequest(`items.${index}: ${product.name} does not accept design uploads`);
    return { item, product, sizes, quantity, neckType, sleeve, designFiles, unitRate: effectivePrice(product) };
  });

  const grandTotal = lines.reduce((sum, l) => sum + l.unitRate * l.quantity, 0);
  const advanceProof = files.find((f) => f.fieldname === 'advanceProof');
  const advance = input.advance.amount;
  if (advance > grandTotal) throw badRequest('advance.amount: Advance cannot be more than the order total');
  if (advance > 0 && input.advance.method !== 'Cash' && !advanceProof) throw badRequest('advanceProof: Upload a screenshot of your payment');
  if (advance === 0 && advanceProof) throw badRequest('advance.amount: Enter the amount you paid');

  const settings = await getSettings();
  const checkoutRef = `WEB-${await nextSequence('website-checkout', 1001)}`;
  const created: Lean[] = [];

  for (const line of lines) {
    const cfg = line.product.productConfig.toLowerCase();
    const hasShorts = cfg.includes('shorts');
    const hasTrouser = cfg.includes('trouser');
    // Expand the size breakdown into one roster row per piece, then overlay any names/numbers given.
    const sizeQueue = line.sizes.flatMap(([size, qty]) => Array.from({ length: qty }, () => size));
    const named = line.item.players.filter((p) => p.name || p.number);
    const players = sizeQueue.map((size, i) => {
      const entry = named[i];
      const pieceSize = entry?.size || size;
      return { name: entry?.name ?? '', number: entry?.number ?? '', sleeve: line.sleeve, jerseySize: pieceSize, shortsSize: hasShorts ? pieceSize : '', trouserSize: hasTrouser ? pieceSize : '' };
    });
    const breakdown = line.sizes.map(([size, qty]) => `${size} × ${qty}`).join(', ');
    const comments = [
      `Website order ${checkoutRef} — ${line.product.name}${line.product.sku ? ` (SKU ${line.product.sku})` : ''}`,
      `Sizes: ${breakdown}`,
      line.item.color ? `Colour: ${line.item.color}` : '',
      line.item.notes ? `Item notes: ${line.item.notes}` : '',
      input.notes ? `Checkout notes: ${input.notes}` : '',
      `Delivery: ${input.shipping.method}${input.shipping.address ? ` — ${input.shipping.address}${input.shipping.city ? `, ${input.shipping.city}` : ''}` : ''} (${input.shipping.recipient}, ${input.shipping.phone})`,
    ].filter(Boolean).join('\n');

    const seq = await nextSequence('order', 26101);
    const order = new Order({
      orderNo: `${settings.orderPrefix}-${seq}`,
      customer: customer._id,
      teamName: line.item.teamName || customer.name,
      productConfig: line.product.productConfig,
      neckType: line.neckType,
      shortsColor: '',
      quantity: line.quantity,
      dueDate: input.dueDate,
      playerListMode: 'manual',
      cuttingStatus: 'pending',
      unitRate: line.unitRate,
      totalAmount: line.unitRate * line.quantity,
      players,
      comments: comments.slice(0, 4000),
      files: line.designFiles.map((f) => ({ storedName: f.filename, originalName: f.originalname, mimeType: f.mimetype, size: f.size, kind: 'reference', uploadedBy: user.id })),
      stage: 'design',
      history: [{ from: null, to: 'design', by: user.id, byName: user.name, note: `Order placed on the website (${checkoutRef})` }],
      createdBy: user.id,
      source: 'website',
      product: line.product._id,
      productName: line.product.name,
      checkoutRef,
      shipping: input.shipping,
    });
    order.status = computeStatus(order);
    await order.save();
    created.push(order.toObject());
    await SiteProduct.updateOne({ _id: line.product._id }, { $inc: { salesCount: line.quantity } });
    await audit(user, 'order.created', 'Order', String(order._id), `Website order ${order.orderNo} (${checkoutRef}) — ${line.quantity} × ${line.product.name}`);
  }

  // Record the advance against the orders, split by value; each payment keeps its own copy of the proof.
  if (advance > 0) {
    let remaining = Math.round(advance * 100);
    for (let i = 0; i < created.length; i++) {
      const order = created[i];
      const share = i === created.length - 1 ? remaining : Math.round((advance * 100 * order.totalAmount) / grandTotal);
      remaining -= share;
      if (share <= 0) continue;
      const proofName = advanceProof ? (i === 0 ? advanceProof.filename : await copyStoredFile(advanceProof.filename)) : null;
      await Payment.create({
        order: order._id,
        customer: customer._id,
        amount: share / 100,
        method: input.advance.method,
        reference: input.advance.reference,
        proof: proofName && advanceProof ? { storedName: proofName, originalName: advanceProof.originalname, mimeType: advanceProof.mimetype, size: advanceProof.size, uploadedBy: user.id } : undefined,
        note: created.length > 1 ? `Advance paid at website checkout ${checkoutRef} (split across ${created.map((o) => o.orderNo).join(', ')})` : `Advance paid at website checkout ${checkoutRef}`,
        recordedBy: user.id,
        status: 'pending',
      });
    }
  }

  void notifyNewWebsiteOrder({ checkoutRef, customerName: customer.name, contactEmail: user.email, orders: created, advance, grandTotal, shipping: input.shipping });

  return {
    checkoutRef,
    total: grandTotal,
    advance,
    orders: created.map((o) => ({ id: String(o._id), orderNo: o.orderNo, productName: o.productName, quantity: o.quantity, totalAmount: o.totalAmount })),
  };
}

// ---------- tracking ----------

export async function trackOrder(orderNo: string, email: string) {
  const order = await Order.findOne({ orderNo: orderNo.trim().toUpperCase() }).lean();
  const fail = () => notFound('We could not find an order with that number and email');
  if (!order) throw fail();
  const normalized = email.trim().toLowerCase();
  const customer = await Customer.findById(order.customer).select('email').lean();
  const matches = customer?.email === normalized || (await User.exists({ customer: order.customer, email: normalized }));
  if (!matches) throw fail();
  return {
    orderNo: order.orderNo,
    teamName: order.teamName,
    productName: order.productName || order.productConfig,
    quantity: order.quantity,
    stage: order.stage,
    stageLabel: STAGE_LABELS[order.stage as Stage],
    status: order.status,
    dueDate: order.dueDate,
    createdAt: (order as Lean).createdAt,
    deliveredAt: order.delivery?.deliveredAt ?? null,
    history: (order.history ?? []).map((h) => ({ stage: h.to, label: STAGE_LABELS[h.to as Stage], at: h.at })),
  };
}

// ---------- notifications ----------

const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const money = (n: number) => `NPR ${n.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

async function businessInbox() {
  const site = await getSiteSettings();
  return site.contact?.email || env.mailFrom;
}

async function safeSend(options: Parameters<typeof sendEmail>[0]) {
  try { await sendEmail(options); } catch (error) {
    if (!env.isProd) console.warn('[site] email not sent:', (error as Error).message);
  }
}

async function notifyNewWebsiteOrder(details: { checkoutRef: string; customerName: string; contactEmail: string; orders: Lean[]; advance: number; grandTotal: number; shipping: CheckoutInput['shipping'] }) {
  const rows = details.orders.map((o) => `${o.orderNo} — ${o.productName} × ${o.quantity} = ${money(o.totalAmount)}`);
  const text = `Checkout ${details.checkoutRef}\nCustomer: ${details.customerName}\n\n${rows.join('\n')}\n\nTotal: ${money(details.grandTotal)}\nAdvance: ${money(details.advance)}\nDelivery: ${details.shipping.method} — ${details.shipping.recipient}, ${details.shipping.phone} ${details.shipping.address}`;
  const list = rows.map((r) => `<li>${escapeHtml(r)}</li>`).join('');
  const portal = `${env.appUrl}/orders?source=website`;
  const inbox = await businessInbox();
  if (inbox) {
    await safeSend({ to: inbox, subject: `New website order ${details.checkoutRef} from ${details.customerName}`, text: `${text}\n\nOpen the portal: ${portal}`, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18241f"><h2>New website order ${escapeHtml(details.checkoutRef)}</h2><p><strong>${escapeHtml(details.customerName)}</strong></p><ul>${list}</ul><p>Total: <strong>${money(details.grandTotal)}</strong><br>Advance: ${money(details.advance)}</p><p><a href="${portal}" style="display:inline-block;background:#173d35;color:#fff;padding:10px 16px;border-radius:7px;text-decoration:none">Open in portal</a></p></div>` });
  }
  if (details.contactEmail) {
    await safeSend({ to: details.contactEmail, subject: `We received your order ${details.checkoutRef}`, text: `Thank you for your order!\n\n${rows.join('\n')}\n\nTotal: ${money(details.grandTotal)}\n\nOur design team will prepare your mockup for approval. You can follow your order in your account: ${env.appUrl}/orders`, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18241f"><h2>Thank you for your order!</h2><p>We received checkout <strong>${escapeHtml(details.checkoutRef)}</strong>:</p><ul>${list}</ul><p>Total: <strong>${money(details.grandTotal)}</strong></p><p>Our design team will prepare your mockup for approval before production starts.</p><p><a href="${env.appUrl}/orders" style="display:inline-block;background:#173d35;color:#fff;padding:10px 16px;border-radius:7px;text-decoration:none">View my orders</a></p></div>` });
  }
}

export async function notifyNewEnquiry(e: { type: string; name: string; email: string; phone: string; message: string; product?: string; team?: string }) {
  const inbox = await businessInbox();
  if (!inbox) return;
  const label = e.type === 'custom' ? 'custom design request' : 'contact message';
  const lines = [`Name: ${e.name}`, `Email: ${e.email}`, `Phone: ${e.phone || '-'}`, e.team ? `Team: ${e.team}` : '', e.product ? `Product: ${e.product}` : '', '', e.message].filter((l) => l !== undefined);
  await safeSend({ to: inbox, subject: `New ${label} from ${e.name}`, text: `${lines.join('\n')}\n\nView in portal: ${env.appUrl}/site/enquiries`, html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#18241f"><h2>New ${label}</h2>${lines.map((l) => `<div>${escapeHtml(l) || '&nbsp;'}</div>`).join('')}<p><a href="${env.appUrl}/site/enquiries">Open in portal</a></p></div>` });
}

export const isShopSize = (value: string): value is (typeof SHOP_SIZES)[number] => (SHOP_SIZES as readonly string[]).includes(value);
