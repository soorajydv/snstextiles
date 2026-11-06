import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ProductGallery } from '@/components/website/ProductGallery';
import { ProductPurchase } from '@/components/website/ProductPurchase';
import { ReviewForm } from '@/components/website/ReviewForm';
import { Breadcrumbs, Price, ProductCard, Prose, Stars } from '@/components/website/shop-ui';
import { SiteIcon } from '@/components/website/SiteIcon';
import { renderMarkdown, markdownToText } from '@/lib/markdown';
import { SITE_URL, getProduct, getShell } from '@/lib/site-data';
import { siteImage } from '@/lib/site-client';

type Props = { params: Promise<{ slug: string }> };

const absolute = (src: string) => (src.startsWith('http') ? src : `${SITE_URL}${siteImage(src)}`);

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const data = await getProduct((await params).slug);
  if (!data) return { title: 'Product not found' };
  const { product } = data;
  const description = product.seoDescription || product.shortDescription || markdownToText(product.description) || `Custom ${product.name} made in Nepal.`;
  return {
    title: product.seoTitle || product.name,
    description,
    alternates: { canonical: `/product/${product.slug}` },
    openGraph: { title: product.name, description, images: product.images.slice(0, 1).map(absolute) },
  };
}

const STOCK_TEXT = { in_stock: 'In stock', made_to_order: 'Made to order', out_of_stock: 'Currently unavailable' } as const;

export default async function ProductPage({ params }: Props) {
  const data = await getProduct((await params).slug);
  if (!data) notFound();
  const { product, related, reviews } = data;
  const { settings } = await getShell();
  const category = product.categories[0];

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    sku: product.sku || undefined,
    image: product.images.map(absolute),
    description: product.shortDescription || markdownToText(product.description, 300),
    brand: { '@type': 'Brand', name: settings.brandName },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'NPR',
      price: product.finalPrice,
      availability: product.stockStatus === 'out_of_stock' ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
      url: `${SITE_URL}/product/${product.slug}`,
    },
    ...(product.ratingCount ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: product.ratingAvg, reviewCount: product.ratingCount } } : {}),
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
      <section className="pdp">
        <div className="wrap">
          <Breadcrumbs items={[{ label: 'Shop', href: '/shop' }, ...(category ? [{ label: category.name, href: `/category/${category.slug}` }] : []), { label: product.name }]} />
          <div className="pdp-grid">
            <ProductGallery product={product} />
            <div className="pdp-info">
              {category && <Link className="pcard-cat" href={`/category/${category.slug}`}>{category.name}</Link>}
              <h1>{product.name}</h1>
              <div className="pdp-meta">
                {product.ratingCount > 0 ? <a href="#reviews"><Stars count={product.ratingCount} value={product.ratingAvg} /></a> : <a className="muted-link" href="#reviews">No reviews yet</a>}
                <span className={`stock stock-${product.stockStatus}`}>{STOCK_TEXT[product.stockStatus]}</span>
                {product.sku && <span className="muted-link">SKU {product.sku}</span>}
              </div>
              <Price large product={product} />
              <p className="pdp-unit">per piece · price includes custom names &amp; numbers</p>
              {product.shortDescription && <p className="pdp-short">{product.shortDescription}</p>}
              <ProductPurchase product={product} />
              <ul className="pdp-assure">
                <li><SiteIcon name="pen" size={18} /> Free design mockup before production</li>
                <li><SiteIcon name="shield" size={18} /> Pay an advance by eSewa, Khalti or bank — or pay later</li>
                <li><SiteIcon name="truck" size={18} /> Delivery across Nepal &amp; worldwide</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      <section className="section-sm">
        <div className="wrap pdp-details">
          <div>
            <h2 className="h-sm">Description</h2>
            {product.description ? <Prose html={renderMarkdown(product.description, siteImage)} /> : <p className="muted">Fully customisable sportswear made in our Kathmandu workshop.</p>}
          </div>
          <aside className="pdp-spec">
            {product.features.length > 0 && (
              <>
                <h2 className="h-sm">Key features</h2>
                <ul className="check-list">{product.features.map((f) => <li key={f}><SiteIcon name="check" size={16} />{f}</li>)}</ul>
              </>
            )}
            <h2 className="h-sm">Specification</h2>
            <dl>
              <div><dt>Style</dt><dd>{product.productConfig}</dd></div>
              <div><dt>Sizes</dt><dd>{product.sizes.join(', ')}</dd></div>
              {product.neckTypes.length > 0 && <div><dt>Neck</dt><dd>{product.neckTypes.join(', ')}</dd></div>}
              {product.sleeves.length > 0 && <div><dt>Sleeves</dt><dd>{product.sleeves.join(', ')}</dd></div>}
              {product.minQuantity > 1 && <div><dt>Minimum order</dt><dd>{product.minQuantity} pieces</dd></div>}
            </dl>
          </aside>
        </div>
      </section>

      <section className="section-sm reviews" id="reviews">
        <div className="wrap reviews-grid">
          <div>
            <h2 className="h-sm">Reviews ({reviews.length})</h2>
            {product.ratingCount > 0 && <p className="reviews-avg"><strong>{product.ratingAvg.toFixed(1)}</strong> <Stars value={product.ratingAvg} /> <span>based on {product.ratingCount} review{product.ratingCount === 1 ? '' : 's'}</span></p>}
            {reviews.length ? (
              <ul className="review-list">
                {reviews.map((r) => (
                  <li key={r.id}>
                    <div className="review-head"><strong>{r.name}</strong><Stars value={r.rating} size={12} /><time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</time></div>
                    <p>{r.body}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="muted">There are no reviews yet. Be the first to review “{product.name}”.</p>}
          </div>
          <ReviewForm productId={product.id} />
        </div>
      </section>

      {related.length > 0 && (
        <section className="section-sm">
          <div className="wrap">
            <div className="section-head"><div><p className="site-kicker">You may also like</p><h2>Related products</h2></div></div>
            <div className="pgrid pgrid-rail">{related.map((p) => <ProductCard key={p.id} product={p} />)}</div>
          </div>
        </section>
      )}
    </>
  );
}
