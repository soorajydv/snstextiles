'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { npr, siteImage, siteRequest } from '@/lib/site-client';
import type { ShopSize } from '@/lib/types';
import { itemQuantity, useCart, type CartItem } from './cart';
import { SiteIcon } from './SiteIcon';

export type LivePrice = { id: string; price: number; available: boolean; minQuantity: number; sizes: ShopSize[]; allowDesignUpload: boolean };

/** Refreshes cart prices from the catalogue so customers always see what checkout will charge. */
export function useLivePrices() {
  const { items, ready, update } = useCart();
  const [live, setLive] = useState<Record<string, LivePrice>>({});
  const [loaded, setLoaded] = useState(false);
  const ids = Array.from(new Set(items.map((i) => i.productId))).sort().join(',');

  useEffect(() => {
    if (!ready) return;
    if (!ids) { setLoaded(true); return; }
    let cancelled = false;
    siteRequest<{ products: LivePrice[] }>('/public/site/cart/prices', { body: { ids: ids.split(',') } })
      .then((result) => {
        if (cancelled) return;
        const map = Object.fromEntries(result.products.map((p) => [p.id, p]));
        setLive(map);
        for (const item of items) {
          const p = map[item.productId];
          if (p && p.price !== item.unitPrice) update(item.key, { unitPrice: p.price });
        }
      })
      .catch(() => undefined)
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ids, ready]);

  const problems = items.map((item) => {
    const p = live[item.productId];
    if (loaded && !p) return 'This product is no longer available — please remove it.';
    if (p && !p.available) return 'This product is currently unavailable — please remove it.';
    if (p && itemQuantity(item) < p.minQuantity) return `Minimum order is ${p.minQuantity} pieces.`;
    if (itemQuantity(item) < 1) return 'Add at least one piece.';
    return '';
  });
  return { live, loaded, problems };
}

export function itemSummary(item: CartItem) {
  return [item.neckType, item.sleeve, item.color && item.color !== 'As shown' ? item.color : '', item.teamName ? `Team: ${item.teamName}` : '', item.players.length ? `${item.players.length} names & numbers` : ''].filter(Boolean).join(' · ');
}

export function CartView() {
  const { items, ready, subtotal, count, update, remove, clear } = useCart();
  const { live, problems } = useLivePrices();

  if (!ready) return <div className="wrap section-sm"><p className="muted">Loading your cart…</p></div>;
  if (!items.length) {
    return (
      <div className="wrap section-sm">
        <div className="empty-state">
          <SiteIcon name="bag" size={40} />
          <h2>Your cart is currently empty</h2>
          <p>Browse the collection or send us your own design.</p>
          <div className="hero-actions"><Link className="site-btn site-btn-dark" href="/shop">Return to shop</Link><Link className="site-btn" href="/custom-jersey">Custom design</Link></div>
        </div>
      </div>
    );
  }

  const setSize = (item: CartItem, size: ShopSize, qty: number) => update(item.key, { sizes: { ...item.sizes, [size]: Math.max(0, Math.min(5000, Math.floor(qty) || 0)) } });
  const blocked = problems.some(Boolean);

  return (
    <div className="wrap cart-layout section-sm">
      <div className="cart-items">
        {items.map((item, index) => {
          const sizes = (live[item.productId]?.sizes ?? (Object.keys(item.sizes) as ShopSize[]));
          const qty = itemQuantity(item);
          return (
            <article className="cart-item" key={item.key}>
              <Link className="cart-thumb" href={`/product/${item.slug}`}>{item.image ? <img alt="" src={siteImage(item.image)} /> : <SiteIcon name="shirt" size={34} />}</Link>
              <div className="cart-info">
                <div className="cart-row">
                  <div>
                    <h3><Link href={`/product/${item.slug}`}>{item.name}</Link></h3>
                    {itemSummary(item) && <p className="cart-meta">{itemSummary(item)}</p>}
                  </div>
                  <button aria-label={`Remove ${item.name}`} className="cart-remove" onClick={() => remove(item.key)} type="button"><SiteIcon name="trash" size={18} /></button>
                </div>
                <div className="cart-sizes">
                  {sizes.map((size) => (
                    <label className="cart-size" key={size}>
                      <span>{size}</span>
                      <input aria-label={`${item.name} size ${size}`} inputMode="numeric" min={0} onChange={(e) => setSize(item, size, Number(e.target.value))} type="number" value={item.sizes[size] ?? 0} />
                    </label>
                  ))}
                </div>
                {item.notes && <p className="cart-meta">Notes: {item.notes}</p>}
                <div className="cart-row cart-row-end">
                  <span className="muted-link">{qty} × {npr(item.unitPrice)}</span>
                  <strong>{npr(qty * item.unitPrice)}</strong>
                </div>
                {problems[index] && <p className="form-error">{problems[index]}</p>}
              </div>
            </article>
          );
        })}
        <div className="cart-row">
          <Link className="text-link" href="/shop">← Continue shopping</Link>
          <button className="link-reset" onClick={clear} type="button">Empty cart</button>
        </div>
      </div>
      <aside className="cart-summary">
        <h2>Order summary</h2>
        <dl>
          <div><dt>Pieces</dt><dd>{count}</dd></div>
          <div><dt>Subtotal</dt><dd>{npr(subtotal)}</dd></div>
          <div><dt>Delivery</dt><dd>Confirmed after order</dd></div>
          <div className="cart-total"><dt>Total</dt><dd>{npr(subtotal)}</dd></div>
        </dl>
        {blocked
          ? <button className="site-btn" disabled type="button">Fix the items above to continue</button>
          : <Link className="site-btn" href="/checkout">Proceed to checkout <SiteIcon name="arrow" /></Link>}
        <ul className="summary-notes">
          <li><SiteIcon name="pen" size={16} /> Design mockup sent for your approval</li>
          <li><SiteIcon name="lock" size={16} /> Pay an advance now or later</li>
        </ul>
      </aside>
    </div>
  );
}
