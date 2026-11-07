'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import type { SiteCategory } from '@/lib/types';
import { useCart } from './cart';
import { SiteIcon } from './SiteIcon';

type Props = { categories: SiteCategory[] };

const LINKS = [
  { href: '/', label: 'Home' },
  { href: '/shop', label: 'Shop' },
  { href: '/custom-jersey', label: 'Custom design' },
  { href: '/blog', label: 'Blog' },
  { href: '/about', label: 'About' },
  { href: '/contact', label: 'Contact' },
];

export function SiteHeader({ categories }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { count, ready } = useCart();
  const [open, setOpen] = useState(false);
  const [shopOpen, setShopOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [scrolled, setScrolled] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);

  const topLevel = categories.filter((c) => !c.parent);
  const childrenOf = (id: string) => categories.filter((c) => c.parent === id);
  const isActive = (href: string) => (href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`) || (href === '/shop' && (pathname.startsWith('/category') || pathname.startsWith('/product'))));

  useEffect(() => { setOpen(false); setShopOpen(false); setSearchOpen(false); }, [pathname]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => { if (searchOpen) searchInput.current?.focus(); }, [searchOpen]);

  // Lock page scroll and support Escape while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const header = headerRef.current;
    const placeDrawer = () => { if (header) header.style.setProperty('--drawer-top', `${Math.max(0, header.getBoundingClientRect().bottom)}px`); };
    placeDrawer();
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const onResize = () => { if (window.innerWidth >= 1100) setOpen(false); else placeDrawer(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  function submitSearch(event: React.FormEvent) {
    event.preventDefault();
    const q = query.trim();
    router.push(q ? `/shop?q=${encodeURIComponent(q)}` : '/shop');
    setSearchOpen(false);
    setOpen(false);
  }

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`} ref={headerRef}>
      <div className="wrap site-header-inner">
        <Link className="site-logo" href="/" aria-label="SNS Textiles — home">
          <strong>SNS</strong><span>TEXTILES</span>
        </Link>

        <nav className="site-nav" aria-label="Main navigation">
          {LINKS.map((link) => link.href === '/shop' ? (
            <div className="site-nav-shop" key={link.href} onMouseEnter={() => setShopOpen(true)} onMouseLeave={() => setShopOpen(false)}>
              <Link aria-current={isActive(link.href) ? 'page' : undefined} className={isActive(link.href) ? 'active' : undefined} href={link.href} onFocus={() => setShopOpen(true)}>
                {link.label}
              </Link>
              {topLevel.length > 0 && (
                <div className="site-mega" data-open={shopOpen} onFocus={() => setShopOpen(true)} onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setShopOpen(false); }}>
                  <div className="site-mega-inner">
                    {topLevel.map((parent) => (
                      <div key={parent.id}>
                        <Link className="site-mega-title" href={`/category/${parent.slug}`}>{parent.name}</Link>
                        {childrenOf(parent.id).map((child) => <Link key={child.id} href={`/category/${child.slug}`}>{child.name}</Link>)}
                      </div>
                    ))}
                    <div>
                      <Link className="site-mega-title" href="/shop">All products</Link>
                      <Link href="/shop?sort=latest">New arrivals</Link>
                      <Link href="/shop?sort=popularity">Best sellers</Link>
                      <Link href="/custom-jersey">Design your own</Link>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link aria-current={isActive(link.href) ? 'page' : undefined} className={isActive(link.href) ? 'active' : undefined} href={link.href} key={link.href}>{link.label}</Link>
          ))}
        </nav>

        <div className="site-header-actions">
          <button aria-expanded={searchOpen} aria-label="Search products" className="site-icon-btn" onClick={() => setSearchOpen((v) => !v)} type="button"><SiteIcon name="search" size={21} /></button>
          <Link aria-label="My account" className="site-icon-btn site-account-btn" href="/account"><SiteIcon name="user" size={21} /></Link>
          <Link aria-label={`Cart${ready && count ? `, ${count} item${count === 1 ? '' : 's'}` : ''}`} className="site-icon-btn site-cart-btn" href="/cart">
            <SiteIcon name="bag" size={21} />
            {ready && count > 0 && <b>{count > 99 ? '99+' : count}</b>}
          </Link>
          <button
            aria-controls="site-drawer"
            aria-expanded={open}
            aria-label={open ? 'Close menu' : 'Open menu'}
            className="site-menu-toggle"
            onClick={() => setOpen((value) => !value)}
            type="button"
          >
            <SiteIcon name={open ? 'close' : 'menu'} size={24} />
          </button>
        </div>
      </div>

      {searchOpen && (
        <form className="site-search" onSubmit={submitSearch} role="search">
          <div className="wrap site-search-inner">
            <SiteIcon name="search" size={20} />
            <input aria-label="Search products" onChange={(e) => setQuery(e.target.value)} placeholder="Search jerseys, hoodies, tracksets…" ref={searchInput} type="search" value={query} />
            <button className="site-btn site-btn-sm" type="submit">Search</button>
          </div>
        </form>
      )}

      <div className="site-drawer" data-open={open} id="site-drawer" aria-hidden={!open} inert={!open}>
        <form className="site-drawer-search" onSubmit={submitSearch} role="search">
          <input aria-label="Search products" onChange={(e) => setQuery(e.target.value)} placeholder="Search products…" type="search" value={query} />
          <button aria-label="Search" type="submit"><SiteIcon name="search" size={20} /></button>
        </form>
        <nav aria-label="Mobile navigation">
          {LINKS.map((link, index) => (
            <Link className={isActive(link.href) ? 'active' : undefined} href={link.href} key={link.href} onClick={() => setOpen(false)}>
              <small>{String(index + 1).padStart(2, '0')}</small>{link.label}
            </Link>
          ))}
        </nav>
        {topLevel.length > 0 && (
          <div className="site-drawer-cats">
            {topLevel.map((parent) => (
              <div key={parent.id}>
                <Link href={`/category/${parent.slug}`} onClick={() => setOpen(false)}><strong>{parent.name}</strong></Link>
                {childrenOf(parent.id).map((child) => <Link href={`/category/${child.slug}`} key={child.id} onClick={() => setOpen(false)}>{child.name}</Link>)}
              </div>
            ))}
          </div>
        )}
        <div className="site-drawer-actions">
          <Link className="site-btn" href="/custom-jersey" onClick={() => setOpen(false)}>Design your kit <SiteIcon name="arrow" /></Link>
          <Link className="site-btn site-btn-ghost" href="/account" onClick={() => setOpen(false)}><SiteIcon name="user" size={18} /> My account</Link>
        </div>
      </div>
      <button aria-hidden="true" className="site-drawer-backdrop" data-open={open} onClick={() => setOpen(false)} tabIndex={-1} type="button" />
    </header>
  );
}
