'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { fetchSiteUser, siteRequest } from '@/lib/site-client';
import type { SiteProduct } from '@/lib/types';

type FavoritesContextValue = {
  products: SiteProduct[];
  ready: boolean;
  authenticated: boolean;
  count: number;
  isFavorite: (productId: string) => boolean;
  toggle: (product: SiteProduct) => Promise<void>;
};

const FavoritesContext = createContext<FavoritesContextValue | null>(null);

export function FavoritesProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<SiteProduct[]>([]);
  const [ready, setReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    siteRequest<{ products: SiteProduct[] }>('/public/site/favorites')
      .then((result) => { setProducts(result.products); setAuthenticated(true); })
      .catch(() => setAuthenticated(false))
      .finally(() => setReady(true));
  }, []);

  const isFavorite = useCallback((productId: string) => products.some((product) => product.id === productId), [products]);

  const toggle = useCallback(async (product: SiteProduct) => {
    let signedIn = authenticated;
    if (!signedIn) {
      const user = await fetchSiteUser();
      if (!user) {
        const next = `${window.location.pathname}${window.location.search}`;
        window.location.assign(`/account/login?next=${encodeURIComponent(next)}`);
        return;
      }
      signedIn = true;
      setAuthenticated(true);
    }

    if (products.some((item) => item.id === product.id)) {
      await siteRequest(`/public/site/favorites/${product.id}`, { method: 'DELETE' });
      setProducts((current) => current.filter((item) => item.id !== product.id));
    } else {
      await siteRequest(`/public/site/favorites/${product.id}`, { method: 'POST' });
      setProducts((current) => [product, ...current]);
    }
  }, [authenticated, products]);

  const value = useMemo(() => ({ products, ready, authenticated, count: products.length, isFavorite, toggle }), [products, ready, authenticated, isFavorite, toggle]);
  return <FavoritesContext.Provider value={value}>{children}</FavoritesContext.Provider>;
}

export function useFavorites() {
  const context = useContext(FavoritesContext);
  if (!context) throw new Error('useFavorites must be used inside FavoritesProvider');
  return context;
}

export function FavoriteButton({ product }: { product: SiteProduct }) {
  const { ready, isFavorite, toggle } = useFavorites();
  const [busy, setBusy] = useState(false);
  const active = isFavorite(product.id);

  async function handleClick(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (busy || !ready) return;
    setBusy(true);
    try { await toggle(product); } catch (error) { console.error('Could not update favorite', error); } finally { setBusy(false); }
  }

  return (
    <button
      aria-label={active ? `Remove ${product.name} from favorites` : `Add ${product.name} to favorites`}
      aria-pressed={active}
      className={`favorite-btn${active ? ' is-active' : ''}`}
      disabled={busy || !ready}
      onClick={handleClick}
      title={active ? 'Remove from favorites' : 'Add to favorites'}
      type="button"
    >
      <svg aria-hidden="true" fill={active ? 'currentColor' : 'none'} height="19" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" viewBox="0 0 24 24" width="19"><path d="M20.8 8.7c0 5.2-8.8 10.2-8.8 10.2S3.2 13.9 3.2 8.7A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.8 2.6Z" /></svg>
    </button>
  );
}

