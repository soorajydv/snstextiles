import Link from 'next/link';
import { ProductCard } from '@/components/website/shop-ui';
import { SiteIcon } from '@/components/website/SiteIcon';
import { getPosts, getProducts, getShell } from '@/lib/site-data';
import { siteImage } from '@/lib/site-client';

const HERO_SRCSET = '/website-assets/sns-hero-800.webp 800w, /website-assets/sns-hero-1400.webp 1400w, /website-assets/sns-hero-1672.webp 1672w';
const BANNER_SRCSET = '/website-assets/sns-custom-banner-800.webp 800w, /website-assets/sns-custom-banner-1400.webp 1400w, /website-assets/sns-custom-banner-2172.webp 2172w';

/** Crops of the hero photo used for category tiles that have no image of their own. */
const TILE_CROPS = [
  { x: '49%', y: '42%', zoom: 2.1 },
  { x: '69%', y: '30%', zoom: 2.3 },
  { x: '96%', y: '28%', zoom: 2.4 },
  { x: '84%', y: '62%', zoom: 2.2 },
];

const STEPS = [
  { icon: 'shirt' as const, title: 'Choose your kit', text: 'Pick a design from the shop or start from scratch with our custom design form.' },
  { icon: 'upload' as const, title: 'Add your details', text: 'Choose sizes, add player names and numbers, and upload your logo or artwork.' },
  { icon: 'pen' as const, title: 'Approve the mockup', text: 'Our designers send a mockup to your account. Nothing is printed until you approve it.' },
  { icon: 'truck' as const, title: 'Made & delivered', text: 'We print, stitch, quality-check and deliver — follow every step in your account.' },
];

const PROMISES = [
  { title: 'Custom design', text: 'Your colours, crest, sponsors, names and numbers.' },
  { title: 'Quality materials', text: 'Breathable performance fabrics built for match day.' },
  { title: 'Full-squad sizing', text: 'Every player sized individually, from juniors to adults.' },
  { title: 'Made in Nepal', text: 'Produced in our own workshop in Kalanki, Kathmandu.' },
];

const AUDIENCES = [
  { icon: 'trophy' as const, name: 'Teams', text: 'Match kits and training wear' },
  { icon: 'users' as const, name: 'Clubs', text: 'Club colours for every age group' },
  { icon: 'school' as const, name: 'Schools', text: 'Sports days, houses and PE kits' },
  { icon: 'briefcase' as const, name: 'Businesses', text: 'Corporate events and branded apparel' },
];

function Kicker({ children }: { children: React.ReactNode }) {
  return <p className="site-kicker">{children}</p>;
}

export default async function HomePage() {
  const [{ settings, categories }, featured, latest, posts] = await Promise.all([
    getShell(),
    getProducts({ featured: '1', limit: '8' }),
    getProducts({ sort: 'latest', limit: '8' }),
    getPosts(1, 3),
  ]);
  const { hero, banner, story } = settings;
  const tiles = (categories.filter((c) => c.showOnHome).length ? categories.filter((c) => c.showOnHome) : categories.filter((c) => !c.parent)).slice(0, 4);
  const showcase = featured.products.length ? featured.products : latest.products;
  const heroImage = siteImage(hero.image);
  const bannerImage = siteImage(banner.image);

  return (
    <>
      {/* ---------- hero ---------- */}
      <section className="hero" aria-labelledby="hero-title">
        <picture className="hero-media">
          {heroImage
            ? <img alt="" decoding="async" fetchPriority="high" src={heroImage} />
            : <img alt="Athletes wearing SNS Textiles football, cricket, basketball and activewear in front of the Himalayas" decoding="async" fetchPriority="high" height={941} sizes="100vw" src="/website-assets/sns-hero-1400.webp" srcSet={HERO_SRCSET} width={1672} />}
        </picture>
        <div className="hero-shade" />
        <div className="wrap hero-inner">
          <div className="hero-copy">
            {hero.kicker && <Kicker>{hero.kicker}</Kicker>}
            <h1 id="hero-title">{hero.titleLine1}<br /><em>{hero.titleLine2}</em></h1>
            {hero.subtitle && <p className="hero-lead">{hero.subtitle}</p>}
            <div className="hero-actions">
              {hero.primaryCta.label && <Link className="site-btn" href={hero.primaryCta.href || '/shop'}>{hero.primaryCta.label} <SiteIcon name="arrow" /></Link>}
              {hero.secondaryCta.label && <Link className="site-btn site-btn-outline" href={hero.secondaryCta.href || '/custom-jersey'}>{hero.secondaryCta.label}</Link>}
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
      {tiles.length > 0 && (
        <section className="section-tight" aria-labelledby="shop-title">
          <div className="wrap">
            <h2 className="visually-hidden" id="shop-title">Shop by sport</h2>
            <div className="category-grid">
              {tiles.map((category, i) => {
                const crop = TILE_CROPS[i % TILE_CROPS.length];
                const own = siteImage(category.image);
                return (
                  <Link className={`category-card${own ? ' has-own-image' : ''}`} href={`/category/${category.slug}`} key={category.id} style={{ '--x': crop.x, '--y': crop.y, '--zoom': own ? 1 : crop.zoom } as React.CSSProperties}>
                    {own
                      ? <img alt="" decoding="async" loading="lazy" src={own} />
                      : <img alt="" decoding="async" loading="lazy" sizes="(min-width: 1024px) 25vw, 50vw" src="/website-assets/sns-hero-800.webp" srcSet={HERO_SRCSET} />}
                    <span className="category-copy">
                      <strong>{category.name}</strong>
                      <small>{category.description || `${category.productCount ?? 0} design${category.productCount === 1 ? '' : 's'}`}</small>
                    </span>
                    <span className="circle-arrow"><SiteIcon name="arrow" size={18} /></span>
                  </Link>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {/* ---------- featured ---------- */}
      {showcase.length > 0 && (
        <section className="section featured" aria-labelledby="featured-title">
          <div className="wrap">
            <div className="section-head">
              <div>
                <Kicker>The collection</Kicker>
                <h2 id="featured-title">{featured.products.length ? 'Featured jerseys' : 'New arrivals'}</h2>
              </div>
              <Link className="text-link" href="/shop">Shop all <SiteIcon name="arrow" size={18} /></Link>
            </div>
            <div className="pgrid pgrid-rail">
              {showcase.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          </div>
        </section>
      )}

      {/* ---------- custom banner ---------- */}
      <section className="custom-banner" aria-labelledby="custom-title">
        <picture className="custom-banner-media">
          {bannerImage
            ? <img alt="" decoding="async" loading="lazy" src={bannerImage} />
            : <img alt="" decoding="async" height={724} loading="lazy" sizes="100vw" src="/website-assets/sns-custom-banner-1400.webp" srcSet={BANNER_SRCSET} width={2172} />}
        </picture>
        <div className="custom-banner-shade" />
        <div className="wrap custom-banner-inner">
          <div>
            {banner.kicker && <Kicker>{banner.kicker}</Kicker>}
            <h2 id="custom-title">{banner.title} <em>{banner.highlight}</em></h2>
            {banner.subtitle && <p>{banner.subtitle}</p>}
          </div>
          {banner.cta.label && <Link className="site-btn" href={banner.cta.href || '/custom-jersey'}>{banner.cta.label} <SiteIcon name="arrow" /></Link>}
        </div>
      </section>

      {/* ---------- process ---------- */}
      <section className="section" aria-labelledby="process-title">
        <div className="wrap">
          <div className="section-head section-head-center">
            <div>
              <Kicker>How it works</Kicker>
              <h2 id="process-title">From idea to kit-day in four steps</h2>
            </div>
          </div>
          <ol className="steps">
            {STEPS.map((step, index) => (
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
      <section className="section story" aria-labelledby="story-title">
        <div className="wrap story-grid">
          <div className="story-mark" aria-hidden="true">
            <span className="story-mark-inner"><strong>SNS</strong><small>Made in Nepal</small></span>
          </div>
          <div className="story-copy">
            {story.kicker && <Kicker>{story.kicker}</Kicker>}
            <h2 id="story-title">{story.title}</h2>
            <p>{story.body}</p>
            <Link className="text-link" href="/about">More about us <SiteIcon name="arrow" size={18} /></Link>
          </div>
          <ul className="story-list">
            {PROMISES.map((item, index) => (
              <li key={item.title}>
                <strong>{String(index + 1).padStart(2, '0')}</strong>
                <div><span>{item.title}</span><small>{item.text}</small></div>
              </li>
            ))}
          </ul>
        </div>
        <div className="wrap">
          <ul className="audience-grid" aria-label="Who we make for">
            {AUDIENCES.map((item) => (
              <li key={item.name}>
                <span className="audience-icon"><SiteIcon name={item.icon} size={24} /></span>
                <div><strong>{item.name}</strong><small>{item.text}</small></div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* ---------- testimonials ---------- */}
      {settings.testimonials.length > 0 && (
        <section className="section testimonials" aria-labelledby="testimonials-title">
          <div className="wrap">
            <div className="section-head"><div><Kicker>Kind words</Kicker><h2 id="testimonials-title">What teams say</h2></div></div>
            <div className="quote-grid">
              {settings.testimonials.map((t) => (
                <figure className="quote-card" key={`${t.name}-${t.quote.slice(0, 20)}`}>
                  <blockquote>“{t.quote}”</blockquote>
                  <figcaption><strong>{t.name}</strong>{t.role && <span>{t.role}</span>}</figcaption>
                </figure>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- gallery ---------- */}
      {settings.gallery.length > 0 && (
        <section className="section gallery" aria-labelledby="gallery-title">
          <div className="wrap">
            <div className="section-head">
              <div><Kicker>Recent work</Kicker><h2 id="gallery-title">Made by SNS</h2></div>
              {settings.social.instagram && <a className="text-link" href={settings.social.instagram} rel="noreferrer" target="_blank">Follow on Instagram <SiteIcon name="arrow" size={18} /></a>}
            </div>
            <div className="gallery-grid">
              {settings.gallery.slice(0, 12).map((src, i) => <img alt={`SNS Textiles kit ${i + 1}`} key={src} loading="lazy" src={siteImage(src)} />)}
            </div>
          </div>
        </section>
      )}

      {/* ---------- journal ---------- */}
      {posts.posts.length > 0 && (
        <section className="section journal" aria-labelledby="journal-title">
          <div className="wrap">
            <div className="section-head">
              <div><Kicker>Stories</Kicker><h2 id="journal-title">From our journal</h2></div>
              <Link className="text-link" href="/blog">All posts <SiteIcon name="arrow" size={18} /></Link>
            </div>
            <div className="journal-grid">
              {posts.posts.map((post, i) => (
                <article className="journal-card" key={post.id}>
                  <Link className="journal-media" href={`/blog/${post.slug}`} style={{ '--x': TILE_CROPS[i % 4].x, '--y': TILE_CROPS[i % 4].y } as React.CSSProperties}>
                    {post.coverImage ? <img alt="" className="is-cover" loading="lazy" src={siteImage(post.coverImage)} /> : <img alt="" loading="lazy" src="/website-assets/sns-hero-800.webp" />}
                  </Link>
                  <div className="journal-copy">
                    <small>{post.tags[0] ?? 'Journal'}</small>
                    <h3><Link href={`/blog/${post.slug}`}>{post.title}</Link></h3>
                    <span className="journal-soon">{new Date(post.publishedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- faq ---------- */}
      {settings.faqs.length > 0 && (
        <section className="section faq" aria-labelledby="faq-title">
          <div className="wrap faq-grid">
            <div>
              <Kicker>Good to know</Kicker>
              <h2 id="faq-title">Frequently asked questions</h2>
              <p className="faq-lead">Can&apos;t find what you need? <Link href="/contact">Send us a message</Link> and we&apos;ll get back to you.</p>
            </div>
            <div className="faq-list">
              {settings.faqs.slice(0, 6).map((item, index) => (
                <details key={item.q} open={index === 0}>
                  <summary>{item.q}<span aria-hidden="true"><SiteIcon name="plus" size={20} /></span></summary>
                  <p>{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ---------- contact CTA ---------- */}
      <section className="contact" aria-labelledby="cta-title">
        <div className="wrap contact-grid">
          <div className="contact-copy">
            <Kicker>Let&apos;s make something</Kicker>
            <h2 id="cta-title">Ready to move<br /><em>together?</em></h2>
            <p>Custom teamwear for football, cricket, basketball, volleyball, badminton and activewear. Order online, or tell us your idea and we&apos;ll come back with a quote and design mockup.</p>
            <div className="hero-actions">
              <Link className="site-btn site-btn-dark" href="/custom-jersey">Start a custom design <SiteIcon name="arrow" /></Link>
              <Link className="site-btn site-btn-line" href="/shop">Browse the shop</Link>
            </div>
          </div>
          <ul className="contact-list contact-list-card">
            {settings.contact.phones.map((phone) => (
              <li key={phone}><a href={`tel:${phone.replace(/[^+\d]/g, '')}`}><span><SiteIcon name="phone" /></span><div><small>Call</small>{phone}</div></a></li>
            ))}
            {settings.contact.email && <li><a href={`mailto:${settings.contact.email}`}><span><SiteIcon name="mail" /></span><div><small>Email</small>{settings.contact.email}</div></a></li>}
            {settings.contact.address && <li><div className="contact-static"><span><SiteIcon name="pin" /></span><div><small>Workshop</small>{settings.contact.address}</div></div></li>}
          </ul>
        </div>
      </section>
    </>
  );
}
