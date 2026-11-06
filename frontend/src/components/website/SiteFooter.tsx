import Link from 'next/link';
import type { Shell } from '@/lib/site-data';
import { appPath } from '@/lib/paths';
import { NewsletterForm } from './forms';
import { SiteIcon } from './SiteIcon';

export function SiteFooter({ shell }: { shell: Shell }) {
  const { settings, categories, footerPages } = shell;
  const { contact, social } = settings;
  const socials = ([
    ['facebook', social.facebook, 'Facebook'],
    ['instagram', social.instagram, 'Instagram'],
    ['tiktok', social.tiktok, 'TikTok'],
    ['youtube', social.youtube, 'YouTube'],
  ] as const).filter(([, href]) => href);
  const shopCats = categories.filter((c) => c.parent || !categories.some((x) => x.parent === c.id)).slice(0, 7);
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="wrap footer-grid">
        <div className="footer-brand">
          <Link className="site-logo" href="/"><strong>SNS</strong><span>TEXTILES</span></Link>
          <p>{settings.tagline}</p>
          {socials.length > 0 && (
            <div className="footer-social">
              {socials.map(([icon, href, label]) => (
                <a aria-label={label} href={href} key={icon} rel="noreferrer" target="_blank"><SiteIcon name={icon} size={18} /></a>
              ))}
            </div>
          )}
        </div>
        <div className="footer-col">
          <h3>Shop</h3>
          <Link href="/shop">All products</Link>
          {shopCats.map((c) => <Link href={`/category/${c.slug}`} key={c.id}>{c.name}</Link>)}
          <Link href="/custom-jersey">Custom design</Link>
        </div>
        <div className="footer-col">
          <h3>Help</h3>
          <Link href="/account">My account</Link>
          <Link href="/order-tracking">Track your order</Link>
          <Link href="/cart">Cart</Link>
          <Link href="/faq">FAQ</Link>
          <Link href="/contact">Contact us</Link>
          {footerPages.map((p) => <Link href={`/${p.slug}`} key={p.slug}>{p.title}</Link>)}
          <Link href="/blog">Blog</Link>
        </div>
        <div className="footer-col">
          <h3>Contact</h3>
          {contact.phones.map((phone) => <a href={`tel:${phone.replace(/[^+\d]/g, '')}`} key={phone}>{phone}</a>)}
          {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
          {contact.address && <span>{contact.address}</span>}
          {contact.openingHours && <span>{contact.openingHours}</span>}
        </div>
        <div className="footer-col footer-news">
          <h3>Stay in the loop</h3>
          <NewsletterForm />
        </div>
      </div>
      <div className="wrap footer-bottom">
        <span>© {year} {settings.brandName}. All rights reserved.</span>
        <span className="footer-bottom-links">
          <a href={appPath('/login')}>Staff portal</a>
          <a href="#top">Back to top ↑</a>
        </span>
      </div>
    </footer>
  );
}
