'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SiteIcon } from './SiteIcon';

const SORTS = [
  ['default', 'Featured'],
  ['popularity', 'Best selling'],
  ['rating', 'Top rated'],
  ['latest', 'Newest'],
  ['price', 'Price: low to high'],
  ['price-desc', 'Price: high to low'],
] as const;

function useQueryUpdater() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    next.delete('page');
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };
}

export function SortSelect() {
  const params = useSearchParams();
  const update = useQueryUpdater();
  return (
    <div className="shop-selects">
      <label>
        <span className="visually-hidden">Sort by</span>
        <select onChange={(e) => update({ sort: e.target.value === 'default' ? null : e.target.value })} value={params.get('sort') ?? 'default'}>
          {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label>
        <span className="visually-hidden">Products per page</span>
        <select onChange={(e) => update({ limit: e.target.value === '24' ? null : e.target.value })} value={params.get('limit') ?? '24'}>
          {['12', '24', '48', '96'].map((n) => <option key={n} value={n}>Show {n}</option>)}
        </select>
      </label>
    </div>
  );
}

export function SearchBox() {
  const params = useSearchParams();
  const update = useQueryUpdater();
  const [q, setQ] = useState(params.get('q') ?? '');
  useEffect(() => setQ(params.get('q') ?? ''), [params]);
  return (
    <form className="shop-search" onSubmit={(e) => { e.preventDefault(); update({ q: q.trim() || null }); }} role="search">
      <SiteIcon name="search" size={18} />
      <input aria-label="Search products" onChange={(e) => setQ(e.target.value)} placeholder="Search products…" type="search" value={q} />
    </form>
  );
}

export function PriceFilter({ min, max }: { min: number; max: number }) {
  const params = useSearchParams();
  const update = useQueryUpdater();
  const [from, setFrom] = useState(params.get('min') ?? '');
  const [to, setTo] = useState(params.get('max') ?? '');
  useEffect(() => { setFrom(params.get('min') ?? ''); setTo(params.get('max') ?? ''); }, [params]);
  return (
    <form className="price-filter" onSubmit={(e) => { e.preventDefault(); update({ min: from || null, max: to || null }); }}>
      <div className="price-filter-row">
        <label><span>Min</span><input inputMode="numeric" min={0} onChange={(e) => setFrom(e.target.value)} placeholder={String(Math.floor(min))} type="number" value={from} /></label>
        <span aria-hidden="true">–</span>
        <label><span>Max</span><input inputMode="numeric" min={0} onChange={(e) => setTo(e.target.value)} placeholder={String(Math.ceil(max))} type="number" value={to} /></label>
      </div>
      <div className="price-filter-actions">
        <button className="site-btn site-btn-sm site-btn-dark" type="submit">Apply</button>
        {(params.get('min') || params.get('max')) && <button className="link-reset" onClick={() => update({ min: null, max: null })} type="button">Clear</button>}
      </div>
    </form>
  );
}

export function FilterToggle({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const params = useSearchParams();
  useEffect(() => setOpen(false), [pathname, params]);
  return (
    <>
      <button aria-expanded={open} className="filter-toggle" onClick={() => setOpen((v) => !v)} type="button">
        <SiteIcon name="menu" size={18} /> {open ? 'Hide filters' : 'Filters'}
      </button>
      <div className="shop-sidebar" data-open={open}>{children}</div>
    </>
  );
}
