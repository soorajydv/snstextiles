import Link from 'next/link';

const categories = [
  { name: 'Football', detail: 'Jerseys', className: 'category-football' },
  { name: 'Cricket', detail: 'Jerseys', className: 'category-cricket' },
  { name: 'Basketball', detail: 'Jerseys', className: 'category-basketball' },
  { name: 'Activewear', detail: 'T-shirts, Hoodies & Tracksets', className: 'category-active' },
];

const products = [
  { name: 'Custom Football Jersey', code: '01', className: 'product-green' },
  { name: 'Custom Cricket Jersey', code: '02', className: 'product-blue' },
  { name: 'Custom Basketball Jersey', code: '03', className: 'product-red' },
  { name: 'Custom Volleyball Jersey', code: '04', className: 'product-white' },
  { name: 'Custom T-shirt', code: '05', className: 'product-black' },
  { name: 'Custom Hoodie', code: '06', className: 'product-gray' },
  { name: 'Custom Trackset', code: '07', className: 'product-track' },
];

const journal = [
  { title: 'Building Stronger Teams Through Custom Sportswear', type: 'Teamwear', className: 'journal-team' },
  { title: 'The Art of Jersey Making in Nepal', type: 'Craft', className: 'journal-craft' },
  { title: 'Sportswear That Represents a Bigger Tomorrow', type: 'Journal', className: 'journal-mountain' },
];

export default function WebsiteLandingPage() {
  return (
    <main className="website-page">
      <div className="website-utility">
        <span>△ Premium Custom Sportswear</span><i /> <span>Made in Nepal</span><i /> <span>Teams</span><i /> <span>Clubs</span><i /> <span>Schools</span><i /> <span>Businesses</span>
        <span className="utility-shipping">▣ Worldwide Shipping</span>
      </div>

      <header className="website-header">
        <Link className="website-logo" href="/website" aria-label="SNS Textiles home"><strong>SNS</strong><span>TEXTILES</span></Link>
        <nav className="website-nav" aria-label="Website navigation">
          <Link className="active" href="#home">Home</Link>
          <Link href="#shop">Shop</Link>
          <Link href="#custom">Custom Design</Link>
          <Link href="#story">Our Story</Link>
          <Link href="#journal">Journal</Link>
          <Link href="#contact">Contact</Link>
        </nav>
        <div className="website-actions">
          <button aria-label="Search" className="website-icon">⌕</button>
          <Link aria-label="Account" className="website-icon" href="#account">♙</Link>
          <Link aria-label="Shopping cart" className="website-cart" href="#cart">🛒<b>0</b></Link>
        </div>
      </header>

      <section className="website-hero" id="home">
        <img src="/website-assets/sns-hero.png" alt="SNS Textiles athletes wearing custom sportswear in the Himalayas" />
        <div className="hero-overlay" />
        <div className="hero-copy">
          <p className="website-kicker">CUSTOM SPORTSWEAR</p>
          <h1>DESIGNED<br /><em>TO MOVE</em></h1>
          <p className="hero-description">Premium teamwear, made for the way your team plays.</p>
          <Link className="website-button" href="#shop">Shop collection <span>→</span></Link>
        </div>
        <div className="hero-side-note"><span>SPORTSWEAR</span><span>FOR A BOLDER</span><span>TOMORROW</span></div>
      </section>

      <section className="website-content website-categories" id="shop">
        {categories.map((category) => (
          <Link className={`category-card ${category.className}`} href={`#${category.name.toLowerCase()}`} key={category.name}>
            <span className="category-shade" />
            <span className="category-copy"><strong>{category.name}</strong><small>{category.detail}</small></span>
            <span className="circle-arrow">↗</span>
          </Link>
        ))}
      </section>

      <section className="website-content featured-section" id="featured">
        <div className="section-heading"><h2>FEATURED JERSEYS</h2><Link href="#shop">View all <span>→</span></Link></div>
        <div className="product-grid">
          {products.map((product) => (
            <article className="product-card" key={product.code}>
              <div className={`product-visual ${product.className}`}><span>SNS</span><small>{product.code}</small></div>
              <div className="product-info"><span>{product.name}</span><button aria-label={`Add ${product.name} to cart`}>🛒</button></div>
              <div className="product-swatches"><i /><i /><i /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="custom-banner" id="custom">
        <img src="/website-assets/sns-custom-banner.png" alt="Close-up of custom sportswear fabric and stitching" />
        <div className="custom-banner-shade" />
        <div className="custom-banner-copy"><p className="website-kicker">CREATE YOUR OWN</p><h2>CUSTOM <em>SPORTSWEAR</em></h2><p>Your team. Your design. No limits.</p></div>
        <Link className="website-button" href="#custom-form">Create your jersey <span>→</span></Link>
      </section>

      <section className="website-content story-section" id="story">
        <div className="story-mark">S<span>&amp;</span>S</div>
        <div><p className="website-kicker">MADE IN NEPAL</p><h2>Built for your team.<br />Made to last.</h2><p>From the first sketch to the final stitch, SNS Textiles brings custom sportswear to teams, clubs, schools and businesses across Nepal and beyond.</p><Link className="text-link" href="#contact">Discover our story <span>→</span></Link></div>
        <div className="story-stats"><div><strong>01</strong><span>Custom design</span></div><div><strong>02</strong><span>Quality materials</span></div><div><strong>03</strong><span>Worldwide shipping</span></div></div>
      </section>

      <section className="website-content journal-section" id="journal">
        <div className="section-heading"><h2>FROM OUR JOURNAL</h2><Link href="#journal">Read all <span>→</span></Link></div>
        <div className="journal-grid">{journal.map((item) => <Link className="journal-card" href="#journal" key={item.title}><div className={`journal-image ${item.className}`} /><div className="journal-copy"><small>{item.type}</small><strong>{item.title}</strong><span>↗</span></div></Link>)}</div>
      </section>

      <section className="website-content contact-section" id="contact">
        <div><p className="website-kicker">LET&apos;S MAKE SOMETHING</p><h2>Ready to move<br /><em>together?</em></h2></div>
        <div className="contact-details"><p>Custom teamwear for football, cricket, basketball, volleyball and activewear.</p><Link className="website-button dark-button" href="#contact-form">Start a conversation <span>→</span></Link><a href="mailto:snstextiles0923@gmail.com">snstextiles0923@gmail.com</a><a href="tel:+9779827330740">+977 9827330740</a></div>
      </section>

      <footer className="website-footer" id="account">
        <div className="footer-main"><Link className="website-logo" href="/website"><strong>SNS</strong><span>TEXTILES</span></Link><p>Premium custom sportswear, made in Nepal.</p><div className="footer-social"><a href="#facebook">f</a><a href="#instagram">◎</a><a href="#youtube">▶</a></div></div>
        <div><h3>Explore</h3><Link href="#shop">Shop</Link><Link href="#custom">Custom Design</Link><Link href="#story">Our Story</Link><Link href="#journal">Journal</Link></div>
        <div><h3>Support</h3><Link href="#contact">Contact</Link><Link href="#account">Login / Sign up</Link><Link href="#tracking">Track order</Link><Link href="#shipping">Shipping &amp; returns</Link></div>
        <div className="footer-newsletter"><h3>Stay in the loop</h3><p>New drops, team stories and offers.</p><div><input aria-label="Email address" placeholder="Your email address" type="email" /><button aria-label="Subscribe">→</button></div></div>
        <div className="footer-bottom"><span>© 2026 SNS Textiles. All rights reserved.</span><span>Terms of Service &nbsp; Privacy Policy</span><span>Worldwide shipping</span></div>
      </footer>
    </main>
  );
}
