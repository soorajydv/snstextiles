import Link from 'next/link';
import type { ReactNode } from 'react';
import { npr, siteImage } from '@/lib/site-client';
import type { SiteProduct } from '@/lib/types';
import { JerseyArt, type JerseyKind } from './JerseyArt';
import { SiteIcon } from './SiteIcon';

export function Price({ product, large }: { product: Pick<SiteProduct, 'price' | 'salePrice' | 'finalPrice'>; large?: boolean }) {
  const onSale = product.salePrice !== null && product.salePrice < product.price;
  return (
    <span className={`price${large ? ' price-lg' : ''}`}>
      <strong>{npr(product.finalPrice)}</strong>
      {onSale && <s>{npr(product.price)}</s>}
      {onSale && large && <em className="price-save">Save {Math.round(((product.price - product.finalPrice) / product.price) * 100)}%</em>}
    </span>
  );
}

export function Stars({ value, count, size = 14 }: { value: number; count?: number; size?: number }) {
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className="stars" aria-label={`Rated ${value.toFixed(1)} out of 5${count !== undefined ? ` from ${count} review${count === 1 ? '' : 's'}` : ''}`}>
      {[1, 2, 3, 4, 5].map((i) => <span key={i} className={i <= rounded ? 'on' : i - 0.5 === rounded ? 'half' : ''} style={{ fontSize: size }}>★</span>)}
      {count !== undefined && <small>({count})</small>}
    </span>
  );
}

function fallbackKind(name: string): JerseyKind {
  const n = name.toLowerCase();
  if (n.includes('hood')) return 'hoodie';
  if (n.includes('track') || n.includes('jacket')) return 'jacket';
  if (n.includes('basket')) return 'vest';
  if (n.includes('cricket') || n.includes('polo')) return 'polo';
  return 'tee';
}

export function ProductImage({ product, sizes = '(min-width: 1024px) 25vw, 50vw', priority }: { product: Pick<SiteProduct, 'name' | 'images'>; sizes?: string; priority?: boolean }) {
  const src = siteImage(product.images[0]);
  if (!src) {
    return (
      <span className="product-fallback">
        <JerseyArt accent="#c7fb3a" kind={fallbackKind(product.name)} main="#17402c" trim="#0d2118" />
      </span>
    );
  }
  return <img alt={product.name} decoding="async" fetchPriority={priority ? 'high' : undefined} loading={priority ? 'eager' : 'lazy'} sizes={sizes} src={src} />;
}

export function ProductCard({ product, priority }: { product: SiteProduct; priority?: boolean }) {
  const onSale = product.salePrice !== null && product.salePrice < product.price;
  const secondImage = product.images[1] ? siteImage(product.images[1]) : '';
  return (
    <article className="pcard">
      <Link className="pcard-media" href={`/product/${product.slug}`} aria-label={product.name}>
        <ProductImage product={product} priority={priority} />
        {secondImage && <img alt="" aria-hidden="true" className="pcard-alt" loading="lazy" src={secondImage} />}
        <span className="pcard-badges">
          {onSale && <span className="badge badge-sale">−{Math.round(((product.price - product.finalPrice) / product.price) * 100)}%</span>}
          {product.stockStatus === 'out_of_stock' && <span className="badge badge-muted">Sold out</span>}
        </span>
      </Link>
      <div className="pcard-body">
        {product.categories[0] && <Link className="pcard-cat" href={`/category/${product.categories[0].slug}`}>{product.categories[0].name}</Link>}
        <h3><Link href={`/product/${product.slug}`}>{product.name}</Link></h3>
        {product.ratingCount > 0 && <Stars value={product.ratingAvg} count={product.ratingCount} size={12} />}
        <div className="pcard-foot">
          <Price product={product} />
          <Link className="pcard-go" href={`/product/${product.slug}`} aria-label={`Customise ${product.name}`}><SiteIcon name="arrow" size={18} /></Link>
        </div>
      </div>
    </article>
  );
}

export function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="crumbs">
      <ol>
        <li><Link href="/">Home</Link></li>
        {items.map((item, i) => (
          <li key={`${item.label}-${i}`}>{item.href && i < items.length - 1 ? <Link href={item.href}>{item.label}</Link> : <span aria-current={i === items.length - 1 ? 'page' : undefined}>{item.label}</span>}</li>
        ))}
      </ol>
    </nav>
  );
}

export function PageIntro({ kicker, title, children, crumbs, dark }: { kicker?: string; title: ReactNode; children?: ReactNode; crumbs?: { label: string; href?: string }[]; dark?: boolean }) {
  return (
    <section className={`page-intro${dark ? ' page-intro-dark' : ''}`}>
      <div className="wrap">
        {crumbs && <Breadcrumbs items={crumbs} />}
        {kicker && <p className="site-kicker">{kicker}</p>}
        <h1>{title}</h1>
        {children && <div className="page-intro-text">{children}</div>}
      </div>
    </section>
  );
}

export function Pager({ page, total, limit, href }: { page: number; total: number; limit: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  if (pages <= 1) return null;
  const nums = Array.from(new Set([1, page - 1, page, page + 1, pages].filter((n) => n >= 1 && n <= pages))).sort((a, b) => a - b);
  return (
    <nav className="pager" aria-label="Pagination">
      {page > 1 ? <Link href={href(page - 1)} rel="prev">← Prev</Link> : <span className="disabled">← Prev</span>}
      {nums.map((n, i) => (
        <span key={n} className="pager-num">
          {i > 0 && n - nums[i - 1] > 1 && <span className="pager-gap">…</span>}
          {n === page ? <span aria-current="page" className="current">{n}</span> : <Link href={href(n)}>{n}</Link>}
        </span>
      ))}
      {page < pages ? <Link href={href(page + 1)} rel="next">Next →</Link> : <span className="disabled">Next →</span>}
    </nav>
  );
}

export function Prose({ html }: { html: string }) {
  return <div className="prose" dangerouslySetInnerHTML={{ __html: html }} />;
}
