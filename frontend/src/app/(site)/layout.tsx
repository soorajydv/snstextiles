import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import { CartProvider } from '@/components/website/cart';
import { FavoritesProvider } from '@/components/website/favorites';
import { SiteFooter } from '@/components/website/SiteFooter';
import { SiteHeader } from '@/components/website/SiteHeader';
import { SiteIcon } from '@/components/website/SiteIcon';
import { SITE_URL, getShell } from '@/lib/site-data';
import './website.css';
import './shop.css';

const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export async function generateMetadata(): Promise<Metadata> {
  const { settings } = await getShell();
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: settings.seo.title, template: `%s | ${settings.brandName}` },
    description: settings.seo.description,
    applicationName: settings.brandName,
    manifest: null,
    openGraph: { type: 'website', siteName: settings.brandName, title: settings.seo.title, description: settings.seo.description, images: ['/website-assets/sns-hero-1400.webp'] },
  };
}

export const viewport: Viewport = { themeColor: '#090d0c' };

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const shell = await getShell();
  const { settings } = shell;
  const parts = settings.announcement.split('·').map((s) => s.trim()).filter(Boolean);
  const whatsapp = settings.contact.whatsapp.replace(/[^\d]/g, '');

  return (
    <div className={`site ${display.variable} ${body.variable}`} id="top">
      <a className="site-skip" href="#main">Skip to content</a>
      <CartProvider>
        <FavoritesProvider>
        {(parts.length > 0 || settings.announcementRight) && (
          <div className="site-utility">
            <div className="wrap site-utility-inner">
              <p>{parts.map((part, i) => <span className={i > 0 ? 'util-extra' : undefined} key={part}>{part}</span>)}</p>
              {settings.announcementRight && <p className="util-ship"><SiteIcon name="globe" size={14} /> {settings.announcementRight}</p>}
            </div>
          </div>
        )}
        <SiteHeader categories={shell.categories} />
        <main id="main">{children}</main>
        <SiteFooter shell={shell} />
        {whatsapp && (
          <a aria-label="Chat with us on WhatsApp" className="whatsapp-fab" href={`https://wa.me/${whatsapp}`} rel="noreferrer" target="_blank">
            <SiteIcon name="whatsapp" size={28} />
          </a>
        )}
        </FavoritesProvider>
      </CartProvider>
    </div>
  );
}
