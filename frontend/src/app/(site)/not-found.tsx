import Link from 'next/link';

export default function SiteNotFound() {
  return (
    <section className="wrap section">
      <div className="empty-state">
        <p className="site-kicker">404</p>
        <h1>We couldn&apos;t find that page</h1>
        <p>The link may be old or the product may have moved.</p>
        <div className="hero-actions">
          <Link className="site-btn site-btn-dark" href="/shop">Browse the shop</Link>
          <Link className="site-btn" href="/">Go to the homepage</Link>
        </div>
      </div>
    </section>
  );
}
