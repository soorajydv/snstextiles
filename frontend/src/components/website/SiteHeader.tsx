'use client';

import { useEffect, useState } from 'react';
import { SiteIcon } from './SiteIcon';

export type NavItem = { id: string; label: string };

type Props = { items: NavItem[]; loginHref: string };

export function SiteHeader({ items, loginHref }: Props) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(items[0]?.id ?? '');
  const [scrolled, setScrolled] = useState(false);

  // Highlight the navigation item for the section currently in view.
  useEffect(() => {
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: '-35% 0px -55% 0px', threshold: [0, 0.25, 0.5, 1] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Lock page scroll and support Escape while the mobile menu is open.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    const onResize = () => { if (window.innerWidth >= 1100) setOpen(false); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <header className={`site-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="wrap site-header-inner">
        <a className="site-logo" href="#home" aria-label="SNS Textiles — back to top" onClick={close}>
          <strong>SNS</strong><span>TEXTILES</span>
        </a>

        <nav className="site-nav" aria-label="Main navigation">
          {items.map((item) => (
            <a aria-current={active === item.id ? 'true' : undefined} className={active === item.id ? 'active' : undefined} href={`#${item.id}`} key={item.id}>{item.label}</a>
          ))}
        </nav>

        <div className="site-header-actions">
          <a className="site-login" href={loginHref}><SiteIcon name="user" size={19} /><span>Customer login</span></a>
          <a className="site-btn site-btn-sm site-header-cta" href="#quote">Get a quote</a>
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

      <div className="site-drawer" data-open={open} id="site-drawer" aria-hidden={!open} inert={!open}>
        <nav aria-label="Mobile navigation">
          {items.map((item, index) => (
            <a className={active === item.id ? 'active' : undefined} href={`#${item.id}`} key={item.id} onClick={close}>
              <small>{String(index + 1).padStart(2, '0')}</small>{item.label}
            </a>
          ))}
        </nav>
        <div className="site-drawer-actions">
          <a className="site-btn" href="#quote" onClick={close}>Get a quote <SiteIcon name="arrow" /></a>
          <a className="site-btn site-btn-ghost" href={loginHref}><SiteIcon name="user" size={18} /> Customer login</a>
        </div>
      </div>
      <button aria-hidden="true" className="site-drawer-backdrop" data-open={open} onClick={close} tabIndex={-1} type="button" />
    </header>
  );
}
