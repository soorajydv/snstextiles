'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { ShopSize } from '@/lib/types';

export type CartPlayer = { name: string; number: string; size: ShopSize | '' };

export type CartItem = {
  key: string;
  productId: string;
  slug: string;
  name: string;
  image: string;
  unitPrice: number;
  minQuantity: number;
  sizes: Partial<Record<ShopSize, number>>;
  sleeve: string;
  neckType: string;
  color: string;
  teamName: string;
  players: CartPlayer[];
  notes: string;
};

type CartContextValue = {
  items: CartItem[];
  ready: boolean;
  count: number;
  subtotal: number;
  add: (item: Omit<CartItem, 'key'>) => void;
  update: (key: string, patch: Partial<CartItem>) => void;
  remove: (key: string) => void;
  clear: () => void;
};

const STORAGE_KEY = 'sns-cart-v1';
const CartContext = createContext<CartContextValue | null>(null);

export const itemQuantity = (item: Pick<CartItem, 'sizes'>) => Object.values(item.sizes).reduce((sum, qty) => sum + (qty ?? 0), 0);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) setItems(parsed.filter((i) => i && typeof i.productId === 'string' && i.sizes));
      }
    } catch { /* storage unavailable */ }
    setReady(true);
    // Keep several open tabs in sync.
    const onStorage = (event: StorageEvent) => {
      if (event.key !== STORAGE_KEY) return;
      try { setItems(event.newValue ? JSON.parse(event.newValue) : []); } catch { /* ignore */ }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); } catch { /* storage unavailable */ }
  }, [items, ready]);

  const add = useCallback((item: Omit<CartItem, 'key'>) => {
    setItems((current) => [...current, { ...item, key: `${item.productId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}` }].slice(-20));
  }, []);
  const update = useCallback((key: string, patch: Partial<CartItem>) => setItems((current) => current.map((i) => (i.key === key ? { ...i, ...patch } : i))), []);
  const remove = useCallback((key: string) => setItems((current) => current.filter((i) => i.key !== key)), []);
  const clear = useCallback(() => setItems([]), []);

  const value = useMemo<CartContextValue>(() => ({
    items,
    ready,
    count: items.reduce((sum, i) => sum + itemQuantity(i), 0),
    subtotal: items.reduce((sum, i) => sum + itemQuantity(i) * i.unitPrice, 0),
    add, update, remove, clear,
  }), [items, ready, add, update, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
