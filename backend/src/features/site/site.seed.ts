import { SiteCategory, SitePage, SitePost, SiteProduct, getSiteSettings } from './site.models';

/** Categories that mirror the existing snstextiles.com menu. */
const CATEGORY_TREE: { name: string; slug: string; children: { name: string; slug: string }[] }[] = [
  {
    name: 'Sports Wear', slug: 'sports-wear', children: [
      { name: 'Football Jersey', slug: 'football-jersey' },
      { name: 'Cricket', slug: 'cricket' },
      { name: 'Volley Ball', slug: 'volley-ball' },
      { name: 'Badminton', slug: 'badminton' },
      { name: 'Basketball', slug: 'basketball' },
    ],
  },
  {
    name: 'Active Wears', slug: 'active-wears', children: [
      { name: 'T-shirts', slug: 't-shirts' },
      { name: 'Hoodie', slug: 'hoodie' },
      { name: 'Trackset', slug: 'trackset' },
    ],
  },
];

const HOME_CATEGORIES = ['football-jersey', 'cricket', 'basketball', 'active-wears'];

const PAGES = [
  {
    slug: 'about', title: 'About us', published: true,
    excerpt: 'High-end sportswear manufactured in Kalanki, Kathmandu.',
    content: `## Quality you can trust\n\nAt SNS Textiles, we specialise in manufacturing high-end sports apparel, including football, cricket and basketball jerseys, as well as other premium sports clothing. We use the latest fabric technology and offer custom solutions for athletes and teams.\n\n### What we make\n\n- Football, cricket, basketball, volleyball and badminton jerseys\n- T-shirts, hoodies and tracksets\n- Fully custom team kits with names, numbers and logos\n\n### Why teams choose us\n\n- Breathable performance fabrics and reinforced stitching\n- Sublimation printing for colours that last\n- Made in Nepal at an affordable price\n\nChoose SNS Textiles for quality you can trust.`,
  },
  { slug: 'privacy-policy', title: 'Privacy policy', published: false, excerpt: '', content: '_Draft — write your privacy policy here and publish it from Website → Pages._' },
  { slug: 'terms-of-service', title: 'Terms of service', published: false, excerpt: '', content: '_Draft — write your terms of service here and publish it from Website → Pages._' },
  { slug: 'shipping-and-returns', title: 'Shipping & returns', published: false, excerpt: '', content: '_Draft — describe delivery areas, charges, timelines and your returns policy here._' },
  { slug: 'size-guide', title: 'Size guide', published: false, excerpt: '', content: '_Draft — add your jersey, shorts and hoodie size charts here._' },
];

/** Creates the website's starting structure once; never overwrites anything an admin has edited. */
export async function ensureSiteDefaults() {
  await getSiteSettings();
  if (!(await SiteCategory.exists({}))) {
    let order = 0;
    for (const parent of CATEGORY_TREE) {
      const created = await SiteCategory.create({ name: parent.name, slug: parent.slug, sortOrder: order++, showOnHome: HOME_CATEGORIES.includes(parent.slug) });
      for (const child of parent.children) {
        await SiteCategory.create({ name: child.name, slug: child.slug, parent: created._id, sortOrder: order++, showOnHome: HOME_CATEGORIES.includes(child.slug) });
      }
    }
  }
  if (!(await SitePage.exists({}))) await SitePage.insertMany(PAGES);
}

/** Demo catalogue for local development (`npm run dev:memory`) only. */
export async function seedDemoCatalogue() {
  if (await SiteProduct.exists({})) return;
  const bySlug = new Map((await SiteCategory.find().lean()).map((c) => [c.slug, c._id]));
  const demo = [
    { name: 'Football Jersey P-1', slug: 'football-jersey-37', cat: 'football-jersey', price: 1500, salePrice: 1100, featured: true, productConfig: 'Full sublimation jersey with plain shorts', sizes: ['S', 'M', 'L', 'XL', '2XL'] },
    { name: 'Black Football Jersey with Custom Name', slug: 'football-jersey-106', cat: 'football-jersey', price: 1500, salePrice: 990, featured: true, productConfig: 'Jersey only — full sublimation' },
    { name: 'White & Sky Blue Striped Basketball Jersey', slug: 'basketball-jersey-b-1', cat: 'basketball', price: 2100, salePrice: 1699, featured: true, productConfig: 'Full sublimation jersey and full sublimation shorts', neckTypes: ['V neck', 'Round neck'], sleeves: ['Half sleeve'] },
    { name: 'Blue Cricket Jersey 013', slug: 'cricket-jersey-013', cat: 'cricket', price: 1800, salePrice: null, featured: true, productConfig: 'Full sublimation jersey with plain trouser', neckTypes: ['Polo neck', 'IPL neck'], sleeves: ['Half sleeve', 'Full sleeve'] },
    { name: 'Red Volleyball Jersey — Lion Pattern', slug: 'red-volleyball-jersey-lion-pattern-symbol-of-energy-power', cat: 'volley-ball', price: 1400, salePrice: 1200, featured: true, productConfig: 'Full sublimation jersey with plain shorts' },
    { name: 'AeroBlast Badminton Set', slug: 'aeroblast-badminton-set', cat: 'badminton', price: 2500, salePrice: 2000, featured: false, productConfig: 'Full sublimation jersey and full sublimation shorts' },
    { name: 'Classic Hoodie', slug: 'classic-hoodie', cat: 'hoodie', price: 2800, salePrice: 2400, featured: true, productConfig: 'Hoodie — front print', allowPersonalisation: false },
    { name: 'Gray Comfortable Tracksuit', slug: 'track-suit-gray-comfortable', cat: 'trackset', price: 3800, salePrice: null, featured: true, productConfig: 'Trackset — jacket and trouser', allowPersonalisation: false },
  ];
  await SiteProduct.insertMany(demo.map((d, i) => ({
    name: d.name, slug: d.slug, price: d.price, salePrice: d.salePrice, featured: d.featured, productConfig: d.productConfig,
    categories: bySlug.get(d.cat) ? [bySlug.get(d.cat)] : [],
    sizes: d.sizes ?? ['S', 'M', 'L', 'XL', '2XL'], neckTypes: d.neckTypes ?? ['Round neck', 'V neck'], sleeves: d.sleeves ?? ['Half sleeve', 'Full sleeve'],
    allowPersonalisation: d.allowPersonalisation ?? true,
    shortDescription: 'Premium breathable fabric, fully customisable with your team name, numbers and logo.',
    description: '### Key features\n\n- Premium breathable performance fabric\n- Fully customisable with name, number, team logo and other designs\n- Reinforced stitching for durability during gameplay\n- Sublimation printing that will not fade or crack\n- Made in Nepal at an affordable price',
    features: ['Breathable performance fabric', 'Sublimation printing', 'Names & numbers included'],
    colors: [{ name: 'As shown', hex: '' }, { name: 'Custom colours', hex: '' }],
    sortOrder: i,
  })));
  await SitePost.create({ title: 'Football Jerseys: Style, Comfort, and Performance', slug: 'guide-to-football-jerseys', excerpt: 'What to look for in a football jersey — fabric, fit and printing.', content: '## Choosing the right football jersey\n\nA great jersey keeps players cool and looks sharp all season.\n\n- **Fabric:** breathable polyester mesh\n- **Fit:** athletic, with room to move\n- **Printing:** sublimation so colours never crack', publishedAt: new Date() });
}
