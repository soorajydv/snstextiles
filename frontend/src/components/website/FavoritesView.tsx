'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ProductCard } from './shop-ui';
import { useFavorites } from './favorites';

export function FavoritesView() {
  const router = useRouter();
  const { products, ready, authenticated } = useFavorites();

  useEffect(() => {
    if (ready && !authenticated) router.replace('/account/login?next=/account/favorites');
  }, [ready, authenticated, router]);

  if (!ready || !authenticated) return <p className="muted">Loading your favorites…</p>;
  if (!products.length) {
    return <div className="empty-state"><h2>No favorites yet</h2><p>Save products you like and come back to them when you are ready to order.</p><a className="site-btn site-btn-dark" href="/shop">Browse products</a></div>;
  }
  return <div className="pgrid">{products.map((product) => <ProductCard key={product.id} product={product} />)}</div>;
}
