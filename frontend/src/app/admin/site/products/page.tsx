'use client';

import { useEffect, useRef, useState } from 'react';
import { api, useApi } from '@/lib/api';
import { useAuth } from '@/components/AuthProvider';
import { useToast } from '@/components/Toast';
import { Badge, ConfirmModal, Empty, Field, Modal, Notice, PageHeader, Spinner, errorMessage } from '@/components/ui';
import { ImageListInput } from '@/components/site/ImageInputs';
import { fmtMoney } from '@/lib/format';
import { assetPath } from '@/lib/paths';
import { renderMarkdown } from '@/lib/markdown';
import { sortTree } from '@/lib/siteTree';
import { SHOP_SIZES, type SiteCategory, type SiteProduct, type StockStatus } from '@/lib/types';

const PAGE_SIZE = 50;
const STOCK_LABELS: Record<StockStatus, string> = { made_to_order: 'Made to order', in_stock: 'In stock', out_of_stock: 'Out of stock' };

type ProductList = { products: SiteProduct[]; total: number; page: number; limit: number };

export default function SiteProductsPage() {
  const { meta } = useAuth();
  const toast = useToast();
  const canManage = meta.permissions.includes('site.manage');
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<SiteProduct | 'new' | null>(null);
  const [deleting, setDeleting] = useState<SiteProduct | null>(null);
  const [importing, setImporting] = useState(false);
  const [localizing, setLocalizing] = useState<{ remaining: number; downloaded: number } | null>(null);

  useEffect(() => { const t = setTimeout(() => setDebounced(search), 300); return () => clearTimeout(t); }, [search]);
  useEffect(() => setPage(1), [debounced, category, status]);

  const qs = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE), sort: 'latest' });
  if (debounced) qs.set('q', debounced);
  if (category === '__none') qs.set('uncategorised', '1');
  else if (category) qs.set('category', category);
  if (status) qs.set('status', status);
  const allowed = meta.permissions.includes('site.view');
  const { data, error, reload } = useApi<ProductList>(allowed ? `/site/products?${qs}` : null);
  const { data: catData } = useApi<{ categories: SiteCategory[] }>(allowed ? '/site/categories' : null);
  const { data: overview, reload: reloadOverview } = useApi<{ counts: { remoteImages: number } }>(allowed ? '/site/overview' : null);
  if (!allowed) return <Notice tone="error">You do not have permission to manage the website.</Notice>;

  const categories = sortTree(catData?.categories ?? []);
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  async function quickUpdate(product: SiteProduct, patch: Partial<Pick<SiteProduct, 'published' | 'featured' | 'stockStatus'>>) {
    try {
      await api(`/site/products/${product.id}`, { method: 'PATCH', body: patch });
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  async function remove(product: SiteProduct) {
    try {
      await api(`/site/products/${product.id}`, { method: 'DELETE' });
      toast(`${product.name} deleted`);
      setDeleting(null);
      reload();
    } catch (err) { toast(errorMessage(err), 'error'); }
  }

  async function localizeImages() {
    setLocalizing({ remaining: overview?.counts.remoteImages ?? 0, downloaded: 0 });
    let downloaded = 0;
    const failures: string[] = [];
    try {
      for (let round = 0; round < 500; round++) {
        const result = await api<{ processed: number; downloaded: number; failed: string[]; remaining: number }>('/site/products/localize-images?limit=5', { method: 'POST' });
        downloaded += result.downloaded;
        failures.push(...result.failed);
        setLocalizing({ remaining: result.remaining, downloaded });
        if (!result.remaining || !result.processed) break;
      }
      toast(`Downloaded ${downloaded} image${downloaded === 1 ? '' : 's'}${failures.length ? ` · ${failures.length} could not be fetched` : ''}`, failures.length ? 'error' : 'ok');
    } catch (err) {
      toast(errorMessage(err), 'error');
    } finally {
      setLocalizing(null);
      reload();
      reloadOverview();
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="WEBSITE"
        title="Products"
        subtitle="Everything customers can order from the online shop. Prices here are what the website charges at checkout."
        actions={canManage && (
          <>
            <button className="btn" onClick={() => setImporting(true)}>Import from WooCommerce</button>
            <button className="btn primary" onClick={() => setEditing('new')}>＋ Add product</button>
          </>
        )}
      />
      {canManage && (overview?.counts.remoteImages ?? 0) > 0 && (
        <Notice tone="warn" style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <span>{localizing ? `Downloading images… ${localizing.downloaded} saved, ${localizing.remaining} product${localizing.remaining === 1 ? '' : 's'} left` : `${overview!.counts.remoteImages} product${overview!.counts.remoteImages === 1 ? '' : 's'} still use images hosted on the old WordPress site.`}</span>
            <button className="btn small" disabled={!!localizing} onClick={localizeImages}>{localizing ? 'Working…' : 'Download old images'}</button>
          </div>
        </Notice>
      )}
      <div className="toolbar">
        <div className="search"><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, SKU or tag…" aria-label="Search products" /></div>
        <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {categories.map(({ category: c, depth }) => <option key={c.id} value={c.id}>{'— '.repeat(depth)}{c.name}</option>)}
          <option value="__none">Uncategorised</option>
        </select>
        <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
          <option value="">Published & drafts</option>
          <option value="published">Published</option>
          <option value="draft">Drafts</option>
        </select>
      </div>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="card flush">
        {!data ? <Spinner /> : !data.products.length ? <Empty>No products found. {canManage && 'Add one or import your WooCommerce catalogue.'}</Empty> : (
          <div className="table-wrap"><table>
            <thead><tr><th>Product</th><th>Categories</th><th className="num">Price</th><th>Stock</th><th>Status</th><th className="num">Sold</th><th /></tr></thead>
            <tbody>
              {data.products.map((p) => (
                <tr key={p.id} className="clickable" onClick={() => canManage && setEditing(p)}>
                  <td>
                    <div className="cell-with-thumb">
                      {p.images[0] ? <img className="site-thumb" src={assetPath(p.images[0])} alt="" /> : <span className="site-thumb empty">▧</span>}
                      <div><strong>{p.name}</strong><div className="muted small">/{p.slug}{p.sku ? ` · ${p.sku}` : ''}</div></div>
                    </div>
                  </td>
                  <td className="wrap small">{p.categories.map((c) => c.name).join(', ') || <span className="muted">—</span>}</td>
                  <td className="num">{p.salePrice !== null ? <><s className="muted small">{fmtMoney(p.price)}</s><br /><strong>{fmtMoney(p.salePrice)}</strong></> : fmtMoney(p.price)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {canManage ? (
                      <select className="btn small" value={p.stockStatus} onChange={(e) => quickUpdate(p, { stockStatus: e.target.value as StockStatus })} aria-label="Stock status">
                        {Object.entries(STOCK_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
                      </select>
                    ) : STOCK_LABELS[p.stockStatus]}
                  </td>
                  <td><Badge>{p.published ? 'Active' : 'Inactive'}</Badge>{p.featured && <span className="pill amber-bg" style={{ marginLeft: 4 }}>★ Featured</span>}</td>
                  <td className="num">{p.salesCount ?? 0}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <div className="table-actions">
                      <a className="btn small" href={`/product/${p.slug}`} target="_blank" rel="noreferrer" title="View on website">↗</a>
                      {canManage && <button className="btn small" onClick={() => quickUpdate(p, { published: !p.published })}>{p.published ? 'Unpublish' : 'Publish'}</button>}
                      {canManage && <button className="btn small" onClick={() => quickUpdate(p, { featured: !p.featured })}>{p.featured ? 'Unfeature' : 'Feature'}</button>}
                      {canManage && <button className="btn small danger" onClick={() => setDeleting(p)}>Delete</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>
      {data && (
        <div className="toolbar" style={{ marginTop: 12, alignItems: 'center', justifyContent: 'space-between' }}>
          <div className="subtitle">{data.total} product{data.total === 1 ? '' : 's'}</div>
          {pages > 1 && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn small" disabled={page <= 1} onClick={() => setPage(page - 1)}>← Prev</button>
              <span className="small muted">Page {page} of {pages}</span>
              <button className="btn small" disabled={page >= pages} onClick={() => setPage(page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}
      {deleting && <ConfirmModal title="Delete product" message={`Delete ${deleting.name}? Its reviews are removed too. Orders already placed are not affected.`} confirmLabel="Delete product" onClose={() => setDeleting(null)} onConfirm={() => remove(deleting)} />}
      {editing && <ProductEditor product={editing === 'new' ? null : editing} categories={categories} productConfigs={meta.productConfigs} neckTypes={meta.neckTypes} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload(); }} />}
      {importing && <ImportModal onClose={() => setImporting(false)} onDone={() => { reload(); reloadOverview(); }} />}
    </>
  );
}

const SLEEVE_OPTIONS = ['Half sleeve', 'Full sleeve'];

function ProductEditor({ product, categories, productConfigs, neckTypes, onClose, onSaved }: {
  product: SiteProduct | null;
  categories: { category: SiteCategory; depth: number }[];
  productConfigs: string[];
  neckTypes: string[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState(() => ({
    name: product?.name ?? '',
    slug: product?.slug ?? '',
    sku: product?.sku ?? '',
    shortDescription: product?.shortDescription ?? '',
    description: product?.description ?? '',
    features: (product?.features ?? []).join('\n'),
    images: product?.images ?? [],
    categories: product?.categories.map((c) => c.id) ?? [],
    tags: (product?.tags ?? []).join(', '),
    price: product ? String(product.price) : '',
    salePrice: product?.salePrice !== null && product?.salePrice !== undefined ? String(product.salePrice) : '',
    productConfig: product?.productConfig ?? productConfigs[0] ?? '',
    neckTypes: product?.neckTypes ?? ['Round neck'],
    sleeves: product?.sleeves ?? ['Half sleeve'],
    sizes: product?.sizes ?? ['S', 'M', 'L', 'XL', '2XL'],
    colors: (product?.colors ?? []).map((c) => (c.hex ? `${c.name}:${c.hex}` : c.name)).join(', '),
    allowPersonalisation: product?.allowPersonalisation ?? true,
    allowDesignUpload: product?.allowDesignUpload ?? true,
    minQuantity: String(product?.minQuantity ?? 1),
    stockStatus: product?.stockStatus ?? 'made_to_order',
    featured: product?.featured ?? false,
    published: product?.published ?? true,
    sortOrder: String(product?.sortOrder ?? 0),
    seoTitle: product?.seoTitle ?? '',
    seoDescription: product?.seoDescription ?? '',
  }));
  const [preview, setPreview] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((f) => ({ ...f, [key]: value }));
  const toggleIn = (key: 'categories' | 'neckTypes' | 'sleeves' | 'sizes', value: string) => setForm((f) => ({ ...f, [key]: (f[key] as string[]).includes(value) ? (f[key] as string[]).filter((v) => v !== value) : [...(f[key] as string[]), value] }));
  const customConfig = !productConfigs.includes(form.productConfig);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      ...form,
      price: Number(form.price),
      salePrice: form.salePrice.trim() === '' ? null : Number(form.salePrice),
      features: form.features.split('\n').map((l) => l.trim()).filter(Boolean),
      tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
      colors: form.colors.split(',').map((c) => c.trim()).filter(Boolean).map((c) => { const [name, hex = ''] = c.split(':'); return { name: name.trim(), hex: hex.trim() }; }),
      minQuantity: Number(form.minQuantity) || 1,
      sortOrder: Number(form.sortOrder) || 0,
      sizes: SHOP_SIZES.filter((s) => form.sizes.includes(s)),
    };
    try {
      await api(product ? `/site/products/${product.id}` : '/site/products', { method: product ? 'PUT' : 'POST', body });
      toast(product ? 'Product updated' : 'Product created');
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <Modal title={product ? `Edit ${product.name}` : 'Add product'} onClose={onClose} wide>
      <form onSubmit={submit}>
        {error && <Notice tone="error" style={{ marginBottom: 14 }}>{error}</Notice>}
        <div className="form-section">
          <h3>Basics</h3>
          <div className="form-grid">
            <Field label="Product name *" full><input required value={form.name} onChange={(e) => set('name', e.target.value)} maxLength={160} /></Field>
            <Field label="URL slug" hint="Leave empty to generate from the name. Keep old WooCommerce slugs so old links keep working."><input value={form.slug} onChange={(e) => set('slug', e.target.value.toLowerCase())} placeholder="football-jersey-p-1" /></Field>
            <Field label="SKU"><input value={form.sku} onChange={(e) => set('sku', e.target.value)} /></Field>
            <Field label="Regular price (NPR) *"><input required type="number" min={0} step="1" value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
            <Field label="Sale price (NPR)" hint="Optional — must be lower than the regular price."><input type="number" min={0} step="1" value={form.salePrice} onChange={(e) => set('salePrice', e.target.value)} /></Field>
            <Field label="Short description" full><textarea rows={2} maxLength={600} value={form.shortDescription} onChange={(e) => set('shortDescription', e.target.value)} /></Field>
          </div>
        </div>

        <div className="form-section">
          <h3>Images</h3>
          <p className="muted">The first image is used on product cards. Images are converted to WebP automatically.</p>
          <ImageListInput value={form.images} onChange={(images) => set('images', images)} max={12} />
        </div>

        <div className="form-section">
          <h3>Categories</h3>
          {!categories.length ? <p className="muted">Create categories first under Website → Categories.</p> : (
            <div className="chip-select">
              {categories.map(({ category: c, depth }) => (
                <label key={c.id}><input type="checkbox" checked={form.categories.includes(c.id)} onChange={() => toggleIn('categories', c.id)} />{depth ? '↳ ' : ''}{c.name}</label>
              ))}
            </div>
          )}
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Tags" hint="Comma separated — used by the shop search." full><input value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="jersey, football, club" /></Field>
          </div>
        </div>

        <div className="form-section">
          <h3>Ordering options</h3>
          <p className="muted">These become the production order details when a customer checks out.</p>
          <div className="form-grid">
            <Field label="Production style *" full hint="Copied to the order's product configuration.">
              <select value={customConfig ? '__custom' : form.productConfig} onChange={(e) => set('productConfig', e.target.value === '__custom' ? '' : e.target.value)}>
                {productConfigs.map((c) => <option key={c}>{c}</option>)}
                <option value="__custom">Custom style…</option>
              </select>
            </Field>
            {customConfig && <Field label="Custom style name *" full><input required maxLength={120} value={form.productConfig} onChange={(e) => set('productConfig', e.target.value)} placeholder="Hoodie — front print" /></Field>}
            <Field label="Sizes customers can choose *" full>
              <div className="chip-select">{SHOP_SIZES.map((s) => <label key={s}><input type="checkbox" checked={form.sizes.includes(s)} onChange={() => toggleIn('sizes', s)} />{s}</label>)}</div>
            </Field>
            <Field label="Neck types *" full>
              <div className="chip-select">{neckTypes.map((n) => <label key={n}><input type="checkbox" checked={form.neckTypes.includes(n)} onChange={() => toggleIn('neckTypes', n)} />{n}</label>)}</div>
            </Field>
            <Field label="Sleeves *" full>
              <div className="chip-select">{SLEEVE_OPTIONS.map((s) => <label key={s}><input type="checkbox" checked={form.sleeves.includes(s)} onChange={() => toggleIn('sleeves', s)} />{s}</label>)}</div>
            </Field>
            <Field label="Colour options" hint="Comma separated. Add a hex code after a colon for a swatch, e.g. Navy:#14234a" full><input value={form.colors} onChange={(e) => set('colors', e.target.value)} placeholder="As shown, Navy:#14234a, Custom colours" /></Field>
            <Field label="Minimum order quantity"><input type="number" min={1} value={form.minQuantity} onChange={(e) => set('minQuantity', e.target.value)} /></Field>
            <Field label="Stock status">
              <select value={form.stockStatus} onChange={(e) => set('stockStatus', e.target.value as StockStatus)}>
                {Object.entries(STOCK_LABELS).map(([k, label]) => <option key={k} value={k}>{label}</option>)}
              </select>
            </Field>
          </div>
          <div className="toggle-row" style={{ marginTop: 10 }}>
            <label className="checkbox-line"><input type="checkbox" checked={form.allowPersonalisation} onChange={(e) => set('allowPersonalisation', e.target.checked)} /> Customers can add team name, player names & numbers</label>
            <label className="checkbox-line"><input type="checkbox" checked={form.allowDesignUpload} onChange={(e) => set('allowDesignUpload', e.target.checked)} /> Customers can upload a logo / design</label>
          </div>
        </div>

        <div className="form-section">
          <h3>Description</h3>
          <p className="muted">Markdown: <code>### Heading</code>, <code>- bullet</code>, <code>**bold**</code>, <code>[link](https://…)</code>.</p>
          <div className="tabs"><button type="button" className={!preview ? 'active' : ''} onClick={() => setPreview(false)}>Write</button><button type="button" className={preview ? 'active' : ''} onClick={() => setPreview(true)}>Preview</button></div>
          {preview
            ? <div className="markdown-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(form.description || '_Nothing yet_', assetPath) }} />
            : <div className="field"><textarea rows={8} value={form.description} onChange={(e) => set('description', e.target.value)} /></div>}
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Key features" hint="One per line — shown as a checklist on the product page." full><textarea rows={4} value={form.features} onChange={(e) => set('features', e.target.value)} placeholder={'Breathable performance fabric\nSublimation printing'} /></Field>
          </div>
        </div>

        <div className="form-section">
          <h3>Visibility & SEO</h3>
          <div className="toggle-row" style={{ marginBottom: 12 }}>
            <label className="checkbox-line"><input type="checkbox" checked={form.published} onChange={(e) => set('published', e.target.checked)} /> Published on the website</label>
            <label className="checkbox-line"><input type="checkbox" checked={form.featured} onChange={(e) => set('featured', e.target.checked)} /> Featured on the homepage</label>
          </div>
          <div className="form-grid">
            <Field label="Sort order" hint="Lower numbers show first in the default sort."><input type="number" value={form.sortOrder} onChange={(e) => set('sortOrder', e.target.value)} /></Field>
            <Field label="SEO title"><input maxLength={160} value={form.seoTitle} onChange={(e) => set('seoTitle', e.target.value)} placeholder={form.name} /></Field>
            <Field label="SEO description" full><textarea rows={2} maxLength={320} value={form.seoDescription} onChange={(e) => set('seoDescription', e.target.value)} /></Field>
          </div>
        </div>

        <div className="form-actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : product ? 'Save product' : 'Create product'}</button>
        </div>
      </form>
    </Modal>
  );
}

function ImportModal({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const csvInput = useRef<HTMLInputElement>(null);
  const xmlInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [summary, setSummary] = useState<{ created: number; updated: number; skipped: number; categoriesCreated: number; slugsMatched: number; errors: string[] } | null>(null);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    const csv = csvInput.current?.files?.[0];
    if (!csv) { setError('Choose the CSV file exported from WooCommerce.'); return; }
    const form = new FormData();
    form.append('files', csv);
    Array.from(xmlInput.current?.files ?? []).slice(0, 5).forEach((f) => form.append('files', f));
    setBusy(true);
    setError('');
    try {
      const result = await api<{ summary: NonNullable<typeof summary> }>('/site/products/import', { method: 'POST', form });
      setSummary(result.summary);
      toast(`Imported ${result.summary.created + result.summary.updated} products`);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Import products from WooCommerce" onClose={onClose}>
      {summary ? (
        <>
          <Notice>
            <strong>{summary.created}</strong> created · <strong>{summary.updated}</strong> updated · {summary.skipped} skipped · {summary.categoriesCreated} new categories · {summary.slugsMatched} old URLs preserved
          </Notice>
          {summary.errors.length > 0 && <Notice tone="warn" style={{ marginTop: 10 }}>{summary.errors.map((e) => <div key={e}>{e}</div>)}</Notice>}
          <p className="subtitle" style={{ marginTop: 12 }}>Images still point to the old site. Use <strong>Download old images</strong> on the products page to copy them here before WordPress is switched off.</p>
          <div className="form-actions"><button className="btn primary" onClick={onClose}>Done</button></div>
        </>
      ) : (
        <form onSubmit={run}>
          <ol className="subtitle" style={{ paddingLeft: 18, marginTop: 0 }}>
            <li>In WordPress go to <strong>Products → All Products → Export</strong>, keep all columns and export all products as CSV.</li>
            <li>Optional: download <code>snstextiles.com/product-sitemap.xml</code> (and <code>product-sitemap2.xml</code>, <code>3</code>…) so each product keeps its old web address.</li>
            <li>Upload them below. Running the import again updates the same products instead of duplicating them.</li>
          </ol>
          {error && <Notice tone="error" style={{ marginBottom: 12 }}>{error}</Notice>}
          <div className="form-grid">
            <Field label="WooCommerce CSV export *" full><input ref={csvInput} type="file" accept=".csv,text/csv" /></Field>
            <Field label="Product sitemap XML files" hint="Optional, up to 5 files." full><input ref={xmlInput} type="file" accept=".xml,text/xml,application/xml" multiple /></Field>
          </div>
          <div className="form-actions">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={busy}>{busy ? 'Importing… this can take a minute' : 'Import products'}</button>
          </div>
        </form>
      )}
    </Modal>
  );
}
