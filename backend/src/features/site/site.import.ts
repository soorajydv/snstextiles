import { Types } from 'mongoose';
import { SHOP_SIZES, SiteCategory, SiteProduct } from './site.models';
import { slugify, storeSiteImage, uniqueSlug } from './site.service';

/** RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF/LF, BOM). */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^﻿/, '');
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field); field = '';
      if (row.some((v) => v !== '')) rows.push(row);
      row = [];
    } else field += c;
  }
  row.push(field);
  if (row.some((v) => v !== '')) rows.push(row);
  return rows;
}

/** Converts WooCommerce HTML descriptions into the light Markdown used by the site. */
export function htmlToMarkdown(html: string): string {
  return html
    .replace(/\\n/g, '\n')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\s*(strong|b)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '**$2**')
    .replace(/<\s*(em|i)\s*>([\s\S]*?)<\s*\/\s*\1\s*>/gi, '*$2*')
    .replace(/<\s*h[1-3][^>]*>([\s\S]*?)<\s*\/\s*h[1-3]\s*>/gi, '\n\n### $1\n\n')
    .replace(/<\s*h[4-6][^>]*>([\s\S]*?)<\s*\/\s*h[4-6]\s*>/gi, '\n\n**$1**\n\n')
    .replace(/<\s*li[^>]*>/gi, '\n- ')
    .replace(/<\s*\/\s*(p|div|ul|ol)\s*>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#8211;|&ndash;/g, '–')
    .replace(/&#8217;|&rsquo;/g, '’')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Strips WordPress size suffixes (-600x600) so thumbnails and originals match. */
const imageKey = (url: string) => url.trim().toLowerCase().replace(/^https?:\/\/[^/]+/, '').replace(/-\d+x\d+(\.[a-z]+)$/, '$1').replace(/-scaled(\.[a-z]+)$/, '$1');

/** Reads a Rank Math / Yoast product sitemap into image → slug so old /product/<slug>/ URLs keep working. */
export function slugsFromSitemaps(xmls: string[]) {
  const byImage = new Map<string, string>();
  for (const xml of xmls) {
    for (const block of xml.split(/<url>/i).slice(1)) {
      const loc = /<loc>\s*([^<]+?)\s*<\/loc>/i.exec(block)?.[1] ?? '';
      const slug = /\/product\/([^/?#]+)\/?/i.exec(loc)?.[1];
      if (!slug) continue;
      for (const m of block.matchAll(/<image:loc>\s*(?:<!\[CDATA\[)?\s*([^<\]]+?)\s*(?:\]\]>)?\s*<\/image:loc>/gi)) {
        byImage.set(imageKey(m[1]), decodeURIComponent(slug).toLowerCase());
      }
    }
  }
  return byImage;
}

const SIZE_ALIASES: Record<string, string> = { XXL: '2XL', XXXL: '3XL', XXXXL: '4XL', 'EXTRA LARGE': 'XL', LARGE: 'L', MEDIUM: 'M', SMALL: 'S' };
function toSizes(values: string[]) {
  const out = new Set<string>();
  for (const v of values) {
    const s = v.trim().toUpperCase();
    const mapped = SIZE_ALIASES[s] ?? s;
    if ((SHOP_SIZES as readonly string[]).includes(mapped)) out.add(mapped);
  }
  return SHOP_SIZES.filter((s) => out.has(s));
}

const splitList = (value: string) => value.split(/(?<!\\),/).map((v) => v.replace(/\\,/g, ',').trim()).filter(Boolean);
const num = (value: string | undefined) => {
  const n = Number(String(value ?? '').replace(/[^0-9.]/g, ''));
  return value && Number.isFinite(n) && String(value).trim() !== '' ? n : null;
};

export type ImportSummary = { created: number; updated: number; skipped: number; categoriesCreated: number; slugsMatched: number; errors: string[] };

export async function importWooCommerceCsv(csv: string, sitemapXmls: string[]): Promise<ImportSummary> {
  const rows = parseCsv(csv);
  if (rows.length < 2) throw new Error('The CSV file has no product rows');
  const header = rows[0].map((h) => h.trim().replace(/^﻿/, ''));
  const col = (name: string) => header.findIndex((h) => h.toLowerCase() === name.toLowerCase());
  const required = ['Type', 'Name'];
  for (const r of required) if (col(r) === -1) throw new Error(`Column "${r}" is missing — export from WooCommerce → Products → Export`);
  const get = (row: string[], name: string) => { const i = col(name); return i === -1 ? '' : (row[i] ?? '').trim(); };
  const attributeCols = Array.from({ length: 6 }, (_, i) => i + 1).filter((i) => col(`Attribute ${i} name`) !== -1);

  const summary: ImportSummary = { created: 0, updated: 0, skipped: 0, categoriesCreated: 0, slugsMatched: 0, errors: [] };
  const slugByImage = slugsFromSitemaps(sitemapXmls);

  // ---- categories ("Sports Wear > Football Jersey, Sports Wear") ----
  const categoryIdByPath = new Map<string, Types.ObjectId>();
  const parentOf = new Map<string, string>();
  for (const c of await SiteCategory.find().lean()) {
    categoryIdByPath.set(`slug:${c.slug}`, c._id);
    if (c.parent) parentOf.set(String(c._id), String(c.parent));
  }
  const isAncestor = (maybeAncestor: string, of: string) => {
    for (let cur = parentOf.get(of); cur; cur = parentOf.get(cur)) if (cur === maybeAncestor) return true;
    return false;
  };
  async function ensurePath(path: string): Promise<Types.ObjectId | null> {
    const parts = path.split('>').map((p) => p.trim()).filter(Boolean);
    let parent: Types.ObjectId | null = null;
    for (const name of parts) {
      const slug = slugify(name);
      let found: Types.ObjectId | undefined = categoryIdByPath.get(`slug:${slug}`);
      if (!found) {
        const createdDoc = await SiteCategory.create({ name, slug: await uniqueSlug(SiteCategory, slug), parent, published: true });
        found = createdDoc._id as Types.ObjectId;
        categoryIdByPath.set(`slug:${slug}`, found);
        if (parent) parentOf.set(String(found), String(parent));
        summary.categoriesCreated++;
      }
      parent = found;
    }
    return parent;
  }

  // ---- variations: collect prices and attribute values per parent ----
  type Variation = { prices: number[]; sales: number[]; attrs: Record<string, Set<string>> };
  const variations = new Map<string, Variation>();
  for (const row of rows.slice(1)) {
    if (!/variation/i.test(get(row, 'Type'))) continue;
    const parent = get(row, 'Parent').replace(/^id:/i, '');
    if (!parent) continue;
    const v = variations.get(parent) ?? { prices: [], sales: [], attrs: {} };
    const regular = num(get(row, 'Regular price'));
    const sale = num(get(row, 'Sale price'));
    if (regular !== null) v.prices.push(regular);
    if (sale !== null) v.sales.push(sale);
    for (const i of attributeCols) {
      const name = get(row, `Attribute ${i} name`).toLowerCase();
      if (!name) continue;
      v.attrs[name] ??= new Set();
      splitList(get(row, `Attribute ${i} value(s)`)).forEach((value) => v.attrs[name].add(value));
    }
    variations.set(parent, v);
  }

  for (const [index, row] of rows.slice(1).entries()) {
    const type = get(row, 'Type').toLowerCase();
    if (!/simple|variable/.test(type) || /variation/.test(type)) { if (!/variation/.test(type)) summary.skipped++; continue; }
    const name = get(row, 'Name');
    if (!name) { summary.skipped++; continue; }
    try {
      const wooId = num(get(row, 'ID'));
      const sku = get(row, 'SKU');
      const variation = wooId !== null ? variations.get(String(wooId)) ?? (sku ? variations.get(sku) : undefined) : undefined;

      let price = num(get(row, 'Regular price'));
      let salePrice = num(get(row, 'Sale price'));
      if (variation) {
        if (price === null && variation.prices.length) price = Math.min(...variation.prices);
        if (salePrice === null && variation.sales.length) salePrice = Math.min(...variation.sales);
      }
      if (price === null) price = salePrice ?? 0;
      if (salePrice !== null && salePrice >= price) salePrice = null;

      const attrs: Record<string, string[]> = {};
      for (const i of attributeCols) {
        const attrName = get(row, `Attribute ${i} name`).toLowerCase();
        if (attrName) attrs[attrName] = splitList(get(row, `Attribute ${i} value(s)`));
      }
      for (const [k, set] of Object.entries(variation?.attrs ?? {})) attrs[k] = [...new Set([...(attrs[k] ?? []), ...set])];
      const sizeValues = Object.entries(attrs).filter(([k]) => /size/.test(k)).flatMap(([, v]) => v);
      const colorValues = Object.entries(attrs).filter(([k]) => /colou?r/.test(k)).flatMap(([, v]) => v);
      const sizes = toSizes(sizeValues);

      const categoryIds: Types.ObjectId[] = [];
      for (const path of splitList(get(row, 'Categories'))) {
        if (/^uncategori[sz]ed$/i.test(path)) continue;
        const leaf = await ensurePath(path);
        if (leaf && !categoryIds.some((c) => c.equals(leaf))) categoryIds.push(leaf);
      }
      // Keep only the deepest categories of each path (e.g. drop "Sports Wear" when "Football Jersey" is present).
      const leafCategories = categoryIds.filter((c) => !categoryIds.some((other) => isAncestor(String(c), String(other))));
      const images = splitList(get(row, 'Images')).filter((u) => /^https?:\/\//i.test(u));
      const legacySlug = images.map((u) => slugByImage.get(imageKey(u))).find(Boolean);
      const lowerName = name.toLowerCase();
      const isJersey = /jersey|kit|set/.test(lowerName) || categoryIds.length > 0;
      const published = get(row, 'Published') === '1';
      const inStock = get(row, 'In stock?');

      const data = {
        name,
        sku,
        shortDescription: htmlToMarkdown(get(row, 'Short description')).slice(0, 600),
        description: htmlToMarkdown(get(row, 'Description')),
        images,
        categories: leafCategories,
        tags: splitList(get(row, 'Tags')).slice(0, 30),
        price,
        salePrice,
        ...(sizes.length ? { sizes } : {}),
        colors: colorValues.slice(0, 20).map((c) => ({ name: c, hex: '' })),
        featured: get(row, 'Is featured?') === '1',
        published,
        stockStatus: (inStock === '0' ? 'out_of_stock' : 'made_to_order') as 'out_of_stock' | 'made_to_order',
        sortOrder: num(get(row, 'Position')) ?? 0,
        productConfig: /hoodie|t-?shirt|polo|track/.test(lowerName) || !isJersey ? name.slice(0, 120) : 'Jersey only — full sublimation',
        wooId,
      };

      const existing = wooId !== null ? await SiteProduct.findOne({ wooId }) : await SiteProduct.findOne({ name, sku });
      if (existing) {
        existing.set(data);
        await existing.save();
        summary.updated++;
      } else {
        let slug = legacySlug && !(await SiteProduct.exists({ slug: legacySlug })) ? legacySlug : '';
        if (slug) summary.slugsMatched++;
        else slug = await uniqueSlug(SiteProduct, name);
        await SiteProduct.create({ ...data, slug });
        summary.created++;
      }
    } catch (error) {
      if (summary.errors.length < 20) summary.errors.push(`Row ${index + 2} (${name}): ${(error as Error).message}`);
      summary.skipped++;
    }
  }
  return summary;
}

/** Downloads remote (e.g. old WordPress) product images into the site's own media store. */
export async function localizeRemoteImages(limit: number, userId: string) {
  const products = await SiteProduct.find({ images: { $elemMatch: { $regex: '^https?://' } } }).limit(limit);
  let downloaded = 0;
  const failed: string[] = [];
  for (const product of products) {
    const images: string[] = [];
    for (const image of product.images) {
      if (!/^https?:\/\//i.test(image)) { images.push(image); continue; }
      try {
        const response = await fetch(image, { signal: AbortSignal.timeout(20000), headers: { 'User-Agent': 'SNS-Textiles-Site-Import/1.0' } });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        if (!(response.headers.get('content-type') ?? '').startsWith('image/')) throw new Error('not an image');
        const buffer = Buffer.from(await response.arrayBuffer());
        if (buffer.length > 20 * 1024 * 1024) throw new Error('too large');
        const stored = await storeSiteImage(buffer, image.split('/').pop() ?? 'image', userId);
        images.push(stored.url);
        downloaded++;
      } catch (error) {
        failed.push(`${product.name}: ${(error as Error).message}`);
        // Drop images that cannot be fetched so the batch does not retry them forever.
      }
    }
    product.images = images;
    await product.save();
  }
  const remaining = await SiteProduct.countDocuments({ images: { $elemMatch: { $regex: '^https?://' } } });
  return { processed: products.length, downloaded, failed: failed.slice(0, 20), remaining };
}
