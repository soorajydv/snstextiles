import Link from 'next/link';
import { Suspense } from 'react';
import { getProducts, getShell } from '@/lib/site-data';
import type { SiteCategory } from '@/lib/types';
import { Pager, ProductCard } from './shop-ui';
import { FilterToggle, PriceFilter, SearchBox, SortSelect } from './ShopControls';

export type ShopParams = { q?: string; sort?: string; min?: string; max?: string; page?: string; limit?: string };

/** Product grid with sidebar filters, used by /shop and /category/[slug]. */
export async function ShopListing({ params, category, basePath }: { params: ShopParams; category?: SiteCategory; basePath: string }) {
  const { categories } = await getShell();
  const page = Math.max(1, Number(params.page) || 1);
  const limit = ['12', '24', '48', '96'].includes(params.limit ?? '') ? params.limit! : '24';
  const result = await getProducts({ q: params.q, sort: params.sort, min: params.min, max: params.max, page: String(page), limit, category: category?.slug });

  const topLevel = categories.filter((c) => !c.parent);
  const childrenOf = (id: string) => categories.filter((c) => c.parent === id);
  const keep = (extra: Record<string, string>) => {
    const qs = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...params, ...extra })) if (v && k !== 'page') qs.set(k, v);
    if (extra.page && extra.page !== '1') qs.set('page', extra.page);
    const s = qs.toString();
    return s ? `${basePath}?${s}` : basePath;
  };
  const filtered = Boolean(params.q || params.min || params.max);
  const from = result.total ? (page - 1) * Number(limit) + 1 : 0;
  const to = Math.min(result.total, page * Number(limit));

  return (
    <div className="wrap shop-layout">
      <Suspense>
        <FilterToggle>
          <div className="shop-block">
            <h2>Search</h2>
            <SearchBox />
          </div>
          <div className="shop-block">
            <h2>Categories</h2>
            <ul className="shop-cats">
              <li><Link className={!category ? 'active' : undefined} href="/shop">All products</Link></li>
              {topLevel.map((parent) => (
                <li key={parent.id}>
                  <Link className={category?.id === parent.id ? 'active' : undefined} href={`/category/${parent.slug}`}>{parent.name} <small>{parent.productCount ?? 0}</small></Link>
                  {childrenOf(parent.id).length > 0 && (
                    <ul>
                      {childrenOf(parent.id).map((child) => (
                        <li key={child.id}><Link className={category?.id === child.id ? 'active' : undefined} href={`/category/${child.slug}`}>{child.name} <small>{child.productCount ?? 0}</small></Link></li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {result.priceRange.max > 0 && (
            <div className="shop-block">
              <h2>Price (NPR)</h2>
              <PriceFilter max={result.priceRange.max} min={result.priceRange.min} />
            </div>
          )}
          <div className="shop-block shop-block-cta">
            <strong>Need something unique?</strong>
            <p>Send us your idea and we&apos;ll design it with you.</p>
            <Link className="site-btn site-btn-sm" href="/custom-jersey">Custom design</Link>
          </div>
        </FilterToggle>
      </Suspense>

      <div className="shop-main">
        <div className="shop-bar">
          <p className="shop-count" aria-live="polite">
            {result.total ? <>Showing <strong>{from}–{to}</strong> of {result.total} product{result.total === 1 ? '' : 's'}</> : 'No products'}
            {params.q && <> for “<strong>{params.q}</strong>”</>}
          </p>
          <Suspense><SortSelect /></Suspense>
        </div>
        {filtered && <p className="shop-reset"><Link href={basePath}>Reset all filters ×</Link></p>}
        {result.products.length ? (
          <div className="pgrid">
            {result.products.map((product, i) => <ProductCard key={product.id} priority={i < 4} product={product} />)}
          </div>
        ) : (
          <div className="empty-state">
            <h2>Nothing here yet</h2>
            <p>{filtered ? 'Try a different search or clear the filters.' : 'New designs are added regularly — or tell us what you need and we will make it.'}</p>
            <div className="hero-actions">
              {filtered && <Link className="site-btn site-btn-dark" href={basePath}>Clear filters</Link>}
              <Link className="site-btn" href="/custom-jersey">Request a custom design</Link>
            </div>
          </div>
        )}
        <Pager href={(n) => keep({ page: String(n) })} limit={Number(limit)} page={page} total={result.total} />
      </div>
    </div>
  );
}
