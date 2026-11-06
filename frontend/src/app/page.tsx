import type { Metadata, Viewport } from 'next';
import { Archivo, Inter } from 'next/font/google';
import { JerseyArt, type JerseyKind } from '@/components/website/JerseyArt';
import { QuoteForm } from '@/components/website/QuoteForm';
import { SiteHeader, type NavItem } from '@/components/website/SiteHeader';
import { SiteIcon } from '@/components/website/SiteIcon';
import { appPath } from '@/lib/paths';
import './website.css';

const display = Archivo({ subsets: ['latin'], axes: ['wdth'], variable: '--font-display', display: 'swap' });
const body = Inter({ subsets: ['latin'], variable: '--font-body', display: 'swap' });

export const metadata: Metadata = {
  title: 'SNS Textiles — Custom Sportswear Made in Nepal',
  description: 'Premium custom jerseys, teamwear and activewear for teams, clubs, schools and businesses. Designed and made in Nepal, shipped worldwide.',
  openGraph: {
    title: 'SNS Textiles — Custom Sportswear Made in Nepal',
    description: 'Premium custom jerseys, teamwear and activewear for teams, clubs, schools and businesses.',
    type: 'website',
    images: ['/website-assets/sns-hero-1400.webp'],
  },
};

export const viewport: Viewport = { themeColor: '#090d0c' };

const CONTACT = {
  email: 'snstextiles0923@gmail.com',
  phone: '+977 9827330740',
  phoneHref: 'tel:+9779827330740',
  location: 'Nepal',
};

/** Add profile URLs here to show social links in the footer. */
const SOCIAL: { label: string; href: string }[] = [];

const nav: NavItem[] = [
  { id: 'home', label: 'Home' },
  { id: 'shop', label: 'Shop' },
  { id: 'process', label: 'How it works' },
  { id: 'story', label: 'Our story' },
  { id: 'journal', label: 'Journal' },
  { id: 'quote', label: 'Contact' },
];

const categories = [
  { name: 'Football', detail: 'Jerseys & kits', x: '49%', y: '42%', zoom: 2.1 },
  { name: 'Cricket', detail: 'Jerseys & whites', x: '69%', y: '30%', zoom: 2.3 },
  { name: 'Basketball', detail: 'Jerseys & shorts', x: '96%', y: '28%', zoom: 2.4 },
  { name: 'Activewear', detail: 'T-shirts, hoodies & tracksets', x: '84%', y: '62%', zoom: 2.2 },
];

type Product = { name: string; tag: string; kind: JerseyKind; main: string; accent: string; trim: string; text?: string; number?: string; swatches: string[]; tone: string };

const products: Product[] = [
  { name: 'Custom Football Jersey', tag: 'Football', kind: 'tee', main: '#17402c', accent: '#c7fb3a', trim: '#0d2118', number: '10', swatches: ['#1b5b3a', '#141a1a', '#f5f3e8'], tone: '#dfe6dd' },
  { name: 'Custom Cricket Jersey', tag: 'Cricket', kind: 'polo', main: '#1a4fb0', accent: '#5a8ce8', trim: '#0e2a63', swatches: ['#1a4fb0', '#8ea8dd', '#c8302c'], tone: '#dce3ec' },
  { name: 'Custom Basketball Jersey', tag: 'Basketball', kind: 'vest', main: '#1c1517', accent: '#c8302c', trim: '#f1ece6', number: '24', swatches: ['#141a1a', '#c8302c', '#f5f3e8'], tone: '#e6dedb' },
  { name: 'Custom Volleyball Jersey', tag: 'Volleyball', kind: 'tee', main: '#f1f3f6', accent: '#2453a6', trim: '#1a2f5c', text: '#142746', number: '12', swatches: ['#2453a6', '#14234a', '#f5f3e8'], tone: '#dce1e8' },
  { name: 'Custom T-shirt', tag: 'Activewear', kind: 'tee', main: '#15191b', accent: '#2c3336', trim: '#0b0e0f', swatches: ['#15191b', '#5b6366', '#f5f3e8'], tone: '#dddedb' },
  { name: 'Custom Hoodie', tag: 'Activewear', kind: 'hoodie', main: '#8a8f91', accent: '#5f6466', trim: '#2a2e30', swatches: ['#c9cccd', '#15191b', '#f5f3e8'], tone: '#e1e3e1' },
  { name: 'Custom Trackset', tag: 'Activewear', kind: 'jacket', main: '#161b1a', accent: '#a8e51f', trim: '#0b0e0d', swatches: ['#3c8a3a', '#141a1a', '#f5f3e8'], tone: '#dfe5da' },
];

const steps = [
  { icon: 'shirt' as const, title: 'Choose your kit', text: 'Pick jerseys, tees, hoodies or tracksets for your sport — mix and match for the whole squad.' },
  { icon: 'upload' as const, title: 'Share your design', text: 'Send your logo, colours and ideas. No artwork yet? Our team can design it with you.' },
  { icon: 'pen' as const, title: 'Approve the mockup', text: 'Review your design with player names, numbers and sizes before anything is printed.' },
  { icon: 'truck' as const, title: 'Made & delivered', text: 'We produce, quality-check and ship your order — in Nepal and worldwide.' },
];

const promises = [
  { title: 'Custom design', text: 'Your colours, crest, sponsors, names and numbers.' },
  { title: 'Quality materials', text: 'Breathable performance fabrics built for match day.' },
  { title: 'Full-squad sizing', text: 'Every player sized individually, from juniors to adults.' },
  { title: 'Worldwide shipping', text: 'Made in Nepal and delivered wherever you play.' },
];

const audiences = [
  { icon: 'trophy' as const, name: 'Teams', text: 'Match kits and training wear' },
  { icon: 'users' as const, name: 'Clubs', text: 'Club colours for every age group' },
  { icon: 'school' as const, name: 'Schools', text: 'Sports days, houses and PE kits' },
  { icon: 'briefcase' as const, name: 'Businesses', text: 'Corporate events and branded apparel' },
];

const journal = [
  { title: 'Building stronger teams through custom sportswear', type: 'Teamwear', x: '42%', y: '40%' },
  { title: 'The art of jersey making in Nepal', type: 'Craft', x: '70%', y: '65%' },
  { title: 'Sportswear that represents a bigger tomorrow', type: 'Journal', x: '75%', y: '8%' },
];

const faqs = [
  { q: 'Can I use my own design or logo?', a: 'Yes. Send us your logo, crest or full artwork and we will prepare a mockup for your approval. If you only have an idea, our team can design it with you.' },
  { q: 'Can you add player names and numbers?', a: 'Yes. Share your squad list with names, numbers and sizes and every garment is personalised individually.' },
  { q: 'How long does an order take?', a: 'It depends on the product, design and quantity. We confirm a delivery date with your quote, before production starts.' },
  { q: 'Do you ship outside Nepal?', a: 'Yes — we ship worldwide. Shipping costs and timelines are included in your quote.' },
  { q: 'How do I track my order?', a: 'Existing customers can log in to the customer portal to follow their order from design through production and delivery.' },
];

const heroSrcSet = '/website-assets/sns-hero-800.webp 800w, /website-assets/sns-hero-1400.webp 1400w, /website-assets/sns-hero-1672.webp 1672w';
const bannerSrcSet = '/website-assets/sns-custom-banner-800.webp 800w, /website-assets/sns-custom-banner-1400.webp 1400w, /website-assets/sns-custom-banner-2172.webp 2172w';

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="site-kicker">{children}</p>;
}

export default function WebsiteLandingPage() {
  const loginHref = appPath('/login');
  const year = new Date().getFullYear();

  return (
    <div className={`site ${display.variable} ${body.variable}`}>
      <a className="site-skip" href="#main">Skip to content</a>

      <div className="site-utility">
        <div className="wrap site-utility-inner">
          <p>
            <span>Premium custom sportswear</span>
            <span className="util-extra">Made in Nepal</span>
            <span className="util-extra">Teams · Clubs · Schools · Businesses</span>
          </p>
          <p className="util-ship"><SiteIcon name="globe" size={14} /> Worldwide shipping</p>
        </div>
      </div>

      <SiteHeader items={nav} loginHref={loginHref} />

      <main id="main">
        {/* ---------- hero ---------- */}
        <section className="hero" id="home" aria-labelledby="hero-title">
          <picture className="hero-media">
            <img
              alt="Athletes wearing SNS Textiles football, cricket, basketball and activewear in front of the Himalayas"
              decoding="async"
              fetchPriority="high"
              height={941}
              sizes="100vw"
              src="/website-assets/sns-hero-1400.webp"
              srcSet={heroSrcSet}
              width={1672}
            />
          </picture>
          <div className="hero-shade" />
          <div className="wrap hero-inner">
            <div className="hero-copy">
              <Kicker>Custom sportswear</Kicker>
              <h1 id="hero-title">Designed<br /><em>to move</em></h1>
              <p className="hero-lead">Premium teamwear, made for the way your team plays — designed with you and made in Nepal.</p>
              <div className="hero-actions">
                <a className="site-btn" href="#quote">Create your kit <SiteIcon name="arrow" /></a>
                <a className="site-btn site-btn-outline" href="#shop">Shop collection</a>
              </div>
            </div>
            <ul className="hero-trust" aria-label="Why SNS Textiles">
              <li><SiteIcon name="shield" size={22} /><span>Premium <br />quality</span></li>
              <li><SiteIcon name="globe" size={22} /><span>Worldwide <br />shipping</span></li>
              <li><SiteIcon name="users" size={22} /><span>Teams <br />&amp; clubs</span></li>
            </ul>
            <p className="hero-note" aria-hidden="true"><span>Sportswear</span><span>for a bolder</span><span>tomorrow</span></p>
          </div>
        </section>

        {/* ---------- categories ---------- */}
        <section className="section-tight" id="shop" aria-labelledby="shop-title">
          <div className="wrap">
            <h2 className="visually-hidden" id="shop-title">Shop by sport</h2>
            <div className="category-grid">
              {categories.map((category) => (
                <a
                  className="category-card"
                  href="#featured"
                  key={category.name}
                  style={{ '--x': category.x, '--y': category.y, '--zoom': category.zoom } as React.CSSProperties}
                >
                  <img alt="" decoding="async" loading="lazy" sizes="(min-width: 1024px) 25vw, 50vw" src="/website-assets/sns-hero-800.webp" srcSet={heroSrcSet} />
                  <span className="category-copy">
                    <strong>{category.name}</strong>
                    <small>{category.detail}</small>
                  </span>
                  <span className="circle-arrow"><SiteIcon name="arrow" size={18} /></span>
                </a>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- featured ---------- */}
        <section className="section featured" id="featured" aria-labelledby="featured-title">
          <div className="wrap">
            <div className="section-head">
              <div>
                <Kicker>The collection</Kicker>
                <h2 id="featured-title">Featured jerseys</h2>
              </div>
              <a className="text-link" href="#quote">Get a quote <SiteIcon name="arrow" size={18} /></a>
            </div>
            <ul className="product-rail">
              {products.map((product) => (
                <li className="product-card" key={product.name}>
                  <a href="#quote" aria-label={`Customise ${product.name}`}>
                    <div className="product-visual" style={{ '--tone': product.tone } as React.CSSProperties}>
                      <JerseyArt accent={product.accent} kind={product.kind} main={product.main} number={product.number} text={product.text} trim={product.trim} />
                    </div>
                    <div className="product-info">
                      <div>
                        <small>{product.tag}</small>
                        <strong>{product.name}</strong>
                      </div>
                      <span className="product-go"><SiteIcon name="plus" size={18} /></span>
                    </div>
                    <div className="product-swatches" aria-label="Example colourways">
                      {product.swatches.map((color) => <i key={color} style={{ background: color }} />)}
                      <span>Any colour</span>
                    </div>
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- custom banner ---------- */}
        <section className="custom-banner" id="custom" aria-labelledby="custom-title">
          <picture className="custom-banner-media">
            <img alt="" decoding="async" height={724} loading="lazy" sizes="100vw" src="/website-assets/sns-custom-banner-1400.webp" srcSet={bannerSrcSet} width={2172} />
          </picture>
          <div className="custom-banner-shade" />
          <div className="wrap custom-banner-inner">
            <div>
              <Kicker>Create your own</Kicker>
              <h2 id="custom-title">Custom <em>sportswear</em></h2>
              <p>Your team. Your design. No limits.</p>
            </div>
            <a className="site-btn" href="#quote">Create your jersey <SiteIcon name="arrow" /></a>
          </div>
        </section>

        {/* ---------- process ---------- */}
        <section className="section" id="process" aria-labelledby="process-title">
          <div className="wrap">
            <div className="section-head section-head-center">
              <div>
                <Kicker>How it works</Kicker>
                <h2 id="process-title">From idea to kit-day in four steps</h2>
              </div>
            </div>
            <ol className="steps">
              {steps.map((step, index) => (
                <li className="step-card" key={step.title}>
                  <span className="step-num">{String(index + 1).padStart(2, '0')}</span>
                  <span className="step-icon"><SiteIcon name={step.icon} size={26} /></span>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ---------- story ---------- */}
        <section className="section story" id="story" aria-labelledby="story-title">
          <div className="wrap story-grid">
            <div className="story-mark" aria-hidden="true">
              <span className="story-mark-inner"><strong>SNS</strong><small>Made in Nepal</small></span>
            </div>
            <div className="story-copy">
              <Kicker>Made in Nepal</Kicker>
              <h2 id="story-title">Built for your team.<br />Made to last.</h2>
              <p>From the first sketch to the final stitch, SNS Textiles brings custom sportswear to teams, clubs, schools and businesses across Nepal and beyond. Every order is designed with you, produced in our own workshop and checked before it leaves.</p>
              <a className="text-link" href="#quote">Start your order <SiteIcon name="arrow" size={18} /></a>
            </div>
            <ul className="story-list">
              {promises.map((item, index) => (
                <li key={item.title}>
                  <strong>{String(index + 1).padStart(2, '0')}</strong>
                  <div><span>{item.title}</span><small>{item.text}</small></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="wrap">
            <ul className="audience-grid" aria-label="Who we make for">
              {audiences.map((item) => (
                <li key={item.name}>
                  <span className="audience-icon"><SiteIcon name={item.icon} size={24} /></span>
                  <div><strong>{item.name}</strong><small>{item.text}</small></div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---------- journal ---------- */}
        <section className="section journal" id="journal" aria-labelledby="journal-title">
          <div className="wrap">
            <div className="section-head">
              <div>
                <Kicker>Stories</Kicker>
                <h2 id="journal-title">From our journal</h2>
              </div>
            </div>
            <div className="journal-grid">
              {journal.map((item) => (
                <article className="journal-card" key={item.title}>
                  <div className="journal-media" style={{ '--x': item.x, '--y': item.y } as React.CSSProperties}>
                    <img alt="" decoding="async" loading="lazy" sizes="(min-width: 900px) 33vw, 40vw" src="/website-assets/sns-hero-800.webp" srcSet={heroSrcSet} />
                  </div>
                  <div className="journal-copy">
                    <small>{item.type}</small>
                    <h3>{item.title}</h3>
                    <span className="journal-soon">Coming soon</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- faq ---------- */}
        <section className="section faq" id="faq" aria-labelledby="faq-title">
          <div className="wrap faq-grid">
            <div>
              <Kicker>Good to know</Kicker>
              <h2 id="faq-title">Frequently asked questions</h2>
              <p className="faq-lead">Can&apos;t find what you need? <a href="#quote">Send us a message</a> and we&apos;ll get back to you.</p>
            </div>
            <div className="faq-list">
              {faqs.map((item, index) => (
                <details key={item.q} open={index === 0}>
                  <summary>{item.q}<span aria-hidden="true"><SiteIcon name="plus" size={20} /></span></summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* ---------- contact / quote ---------- */}
        <section className="contact" id="quote" aria-labelledby="quote-title">
          <div className="wrap contact-grid">
            <div className="contact-copy">
              <Kicker>Let&apos;s make something</Kicker>
              <h2 id="quote-title">Ready to move<br /><em>together?</em></h2>
              <p>Custom teamwear for football, cricket, basketball, volleyball and activewear. Tell us what you need and we&apos;ll come back with a quote and design mockup.</p>
              <ul className="contact-list">
                <li><a href={`mailto:${CONTACT.email}`}><span><SiteIcon name="mail" /></span><div><small>Email</small>{CONTACT.email}</div></a></li>
                <li><a href={CONTACT.phoneHref}><span><SiteIcon name="phone" /></span><div><small>Phone</small>{CONTACT.phone}</div></a></li>
                <li><div className="contact-static"><span><SiteIcon name="pin" /></span><div><small>Workshop</small>{CONTACT.location}</div></div></li>
              </ul>
            </div>
            <QuoteForm email={CONTACT.email} products={products.map((product) => product.name)} />
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="wrap footer-grid">
          <div className="footer-brand">
            <a className="site-logo" href="#home"><strong>SNS</strong><span>TEXTILES</span></a>
            <p>Premium custom sportswear for teams, clubs, schools and businesses. Made in Nepal.</p>
            {SOCIAL.length ? (
              <div className="footer-social">
                {SOCIAL.map((item) => <a aria-label={item.label} href={item.href} key={item.label} rel="noreferrer" target="_blank">{item.label}</a>)}
              </div>
            ) : null}
          </div>
          <div className="footer-col">
            <h3>Explore</h3>
            <a href="#shop">Shop</a>
            <a href="#custom">Custom design</a>
            <a href="#process">How it works</a>
            <a href="#story">Our story</a>
            <a href="#journal">Journal</a>
          </div>
          <div className="footer-col">
            <h3>Support</h3>
            <a href="#quote">Get a quote</a>
            <a href="#faq">FAQ</a>
            <a href={loginHref}>Customer login</a>
            <a href={loginHref}>Track your order</a>
          </div>
          <div className="footer-col">
            <h3>Contact</h3>
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
            <a href={CONTACT.phoneHref}>{CONTACT.phone}</a>
            <span>{CONTACT.location} · Worldwide shipping</span>
          </div>
        </div>
        <div className="wrap footer-bottom">
          <span>© {year} SNS Textiles. All rights reserved.</span>
          <a href="#home">Back to top ↑</a>
        </div>
      </footer>
    </div>
  );
}
