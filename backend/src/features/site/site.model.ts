import { Schema, model, type InferSchemaType } from 'mongoose';
import { NECK_TYPES, SLEEVES } from '../../lib/constants';

export const STOCK_STATUSES = ['in_stock', 'made_to_order', 'out_of_stock'] as const;
export const ENQUIRY_TYPES = ['custom', 'contact'] as const;
export const ENQUIRY_STATUSES = ['new', 'in_progress', 'closed'] as const;
export const REVIEW_STATUSES = ['pending', 'approved', 'rejected'] as const;
export const SHOP_SIZES = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'] as const;

const fileSchema = new Schema(
  {
    storedName: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
  },
  { _id: false },
);

// ---------- catalogue ----------

const categorySchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    parent: { type: Schema.Types.ObjectId, ref: 'SiteCategory', default: null },
    description: { type: String, trim: true, default: '' },
    image: { type: String, trim: true, default: '' },
    sortOrder: { type: Number, default: 0 },
    showOnHome: { type: Boolean, default: false },
    published: { type: Boolean, default: true },
  },
  { timestamps: true },
);
export const SiteCategory = model('SiteCategory', categorySchema);
export type SiteCategoryAttrs = InferSchemaType<typeof categorySchema>;

const productSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    sku: { type: String, trim: true, default: '' },
    shortDescription: { type: String, trim: true, default: '' },
    description: { type: String, default: '' },
    features: { type: [String], default: [] },
    images: { type: [String], default: [] },
    categories: { type: [{ type: Schema.Types.ObjectId, ref: 'SiteCategory' }], default: [], index: true },
    tags: { type: [String], default: [] },
    price: { type: Number, required: true, min: 0 },
    salePrice: { type: Number, default: null, min: 0 },
    /** Production details copied onto the factory order created at checkout. */
    productConfig: { type: String, trim: true, default: 'Jersey only — full sublimation', maxlength: 120 },
    neckTypes: { type: [{ type: String, enum: NECK_TYPES }], default: ['Round neck'] },
    sleeves: { type: [{ type: String, enum: SLEEVES }], default: ['Half sleeve'] },
    sizes: { type: [{ type: String, enum: SHOP_SIZES }], default: ['S', 'M', 'L', 'XL', '2XL'] },
    colors: { type: [{ name: { type: String, trim: true }, hex: { type: String, trim: true, default: '' }, _id: false }], default: [] },
    allowPersonalisation: { type: Boolean, default: true },
    allowDesignUpload: { type: Boolean, default: true },
    minQuantity: { type: Number, default: 1, min: 1 },
    stockStatus: { type: String, enum: STOCK_STATUSES, default: 'made_to_order' },
    featured: { type: Boolean, default: false, index: true },
    published: { type: Boolean, default: true, index: true },
    sortOrder: { type: Number, default: 0 },
    salesCount: { type: Number, default: 0 },
    ratingAvg: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    seoTitle: { type: String, trim: true, default: '' },
    seoDescription: { type: String, trim: true, default: '' },
    wooId: { type: Number, default: null },
  },
  { timestamps: true },
);
productSchema.index({ wooId: 1 }, { unique: true, partialFilterExpression: { wooId: { $type: 'number' } } });
productSchema.index({ published: 1, sortOrder: 1, createdAt: -1 });
export const SiteProduct = model('SiteProduct', productSchema);
export type SiteProductAttrs = InferSchemaType<typeof productSchema>;

// ---------- content ----------

const pageSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 160 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    excerpt: { type: String, trim: true, default: '' },
    content: { type: String, default: '' },
    published: { type: Boolean, default: true },
    showInFooter: { type: Boolean, default: true },
    seoTitle: { type: String, trim: true, default: '' },
    seoDescription: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);
export const SitePage = model('SitePage', pageSchema);

const postSchema = new Schema(
  {
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true, trim: true, lowercase: true },
    excerpt: { type: String, trim: true, default: '' },
    content: { type: String, default: '' },
    coverImage: { type: String, trim: true, default: '' },
    tags: { type: [String], default: [] },
    authorName: { type: String, trim: true, default: 'SNS Textiles' },
    published: { type: Boolean, default: true, index: true },
    publishedAt: { type: Date, default: Date.now },
    seoTitle: { type: String, trim: true, default: '' },
    seoDescription: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);
export const SitePost = model('SitePost', postSchema);

const mediaSchema = new Schema(
  {
    storedName: { type: String, required: true, unique: true },
    originalName: { type: String, default: '' },
    mimeType: { type: String, required: true },
    size: { type: Number, default: 0 },
    alt: { type: String, trim: true, default: '' },
    uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);
export const SiteMedia = model('SiteMedia', mediaSchema);

// ---------- customer interaction ----------

const enquirySchema = new Schema(
  {
    type: { type: String, enum: ENQUIRY_TYPES, required: true, index: true },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true },
    phone: { type: String, trim: true, default: '' },
    team: { type: String, trim: true, default: '' },
    product: { type: String, trim: true, default: '' },
    quantity: { type: Number, default: null },
    neededBy: { type: Date, default: null },
    subject: { type: String, trim: true, default: '' },
    message: { type: String, trim: true, default: '' },
    files: { type: [fileSchema], default: [] },
    status: { type: String, enum: ENQUIRY_STATUSES, default: 'new', index: true },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true },
);
export const SiteEnquiry = model('SiteEnquiry', enquirySchema);

const reviewSchema = new Schema(
  {
    product: { type: Schema.Types.ObjectId, ref: 'SiteProduct', required: true, index: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, trim: true, lowercase: true, default: '' },
    rating: { type: Number, required: true, min: 1, max: 5 },
    body: { type: String, trim: true, default: '' },
    status: { type: String, enum: REVIEW_STATUSES, default: 'pending', index: true },
  },
  { timestamps: true },
);
export const SiteReview = model('SiteReview', reviewSchema);

const subscriberSchema = new Schema(
  {
    email: { type: String, required: true, unique: true, trim: true, lowercase: true },
    active: { type: Boolean, default: true },
    source: { type: String, trim: true, default: 'website' },
  },
  { timestamps: true },
);
export const SiteSubscriber = model('SiteSubscriber', subscriberSchema);

// ---------- settings ----------

const linkSchema = { label: { type: String, trim: true, default: '' }, href: { type: String, trim: true, default: '' } };

const siteSettingsSchema = new Schema(
  {
    _id: { type: String, default: 'site' },
    brandName: { type: String, default: 'SNS Textiles' },
    tagline: { type: String, default: 'Premium custom sportswear, made in Nepal.' },
    announcement: { type: String, default: 'Premium custom sportswear · Made in Nepal · Teams · Clubs · Schools · Businesses' },
    announcementRight: { type: String, default: 'Worldwide shipping' },
    contact: {
      phones: { type: [String], default: ['+977 9827330740', '+977 9763473823'] },
      email: { type: String, default: 'snstextiles0923@gmail.com' },
      whatsapp: { type: String, default: '' },
      address: { type: String, default: 'Kalanki, Kathmandu, Nepal' },
      openingHours: { type: String, default: '' },
      mapEmbedUrl: { type: String, default: '' },
    },
    social: {
      facebook: { type: String, default: 'https://www.facebook.com/profile.php?id=61554817139193' },
      instagram: { type: String, default: 'https://www.instagram.com/snssports.np/' },
      tiktok: { type: String, default: '' },
      youtube: { type: String, default: '' },
    },
    hero: {
      kicker: { type: String, default: 'Custom sportswear' },
      titleLine1: { type: String, default: 'Designed' },
      titleLine2: { type: String, default: 'to move' },
      subtitle: { type: String, default: 'Premium teamwear, made for the way your team plays — designed with you and made in Nepal.' },
      primaryCta: { type: linkSchema, default: { label: 'Shop collection', href: '/shop' } },
      secondaryCta: { type: linkSchema, default: { label: 'Custom design', href: '/custom-jersey' } },
      image: { type: String, default: '' },
    },
    banner: {
      kicker: { type: String, default: 'Create your own' },
      title: { type: String, default: 'Custom' },
      highlight: { type: String, default: 'sportswear' },
      subtitle: { type: String, default: 'Your team. Your design. No limits.' },
      cta: { type: linkSchema, default: { label: 'Create your jersey', href: '/custom-jersey' } },
      image: { type: String, default: '' },
    },
    story: {
      kicker: { type: String, default: 'Made in Nepal' },
      title: { type: String, default: 'Built for your team. Made to last.' },
      body: { type: String, default: 'At SNS Textiles we manufacture high-end football, cricket and basketball jerseys and other premium sportswear. From the first sketch to the final stitch, every order is designed with you, produced in our own workshop and checked before it leaves.' },
    },
    faqs: {
      type: [{ q: { type: String, trim: true }, a: { type: String, trim: true }, _id: false }],
      default: [
        { q: 'Can I use my own design or logo?', a: 'Yes. Upload your logo or artwork when you order, or send it through the custom design form. We prepare a mockup for your approval before printing.' },
        { q: 'Can you add player names and numbers?', a: 'Yes. Add your squad list with names, numbers and sizes when you order and every garment is personalised individually.' },
        { q: 'How long does an order take?', a: 'It depends on the design and quantity. Choose your needed-by date at checkout and we confirm the delivery date before production starts.' },
        { q: 'How do I pay?', a: 'You can pay an advance by eSewa, Khalti, Fonepay or bank transfer when you check out and upload the payment screenshot, or pay later. The balance is due before delivery.' },
        { q: 'How do I track my order?', a: 'Sign in to your account to follow your order from design through production and delivery, or use the order tracking page with your order number and email.' },
      ],
    },
    testimonials: { type: [{ name: { type: String, trim: true }, role: { type: String, trim: true }, quote: { type: String, trim: true }, _id: false }], default: [] },
    gallery: { type: [String], default: [] },
    checkout: {
      minLeadDays: { type: Number, default: 10, min: 0, max: 120 },
      deliveryMethods: { type: [String], default: ['Delivery to my address', 'Pickup from workshop'] },
      deliveryNote: { type: String, default: 'Delivery charges, if any, are confirmed with you before dispatch.' },
      paymentInstructions: { type: String, default: 'You can pay an advance now by eSewa, Khalti, Fonepay or bank transfer and upload the screenshot, or choose to pay later. Our team verifies every payment.' },
    },
    seo: {
      title: { type: String, default: 'SNS Textiles — Custom Sportswear Made in Nepal' },
      description: { type: String, default: 'Premium custom football, cricket, basketball and volleyball jerseys, T-shirts, hoodies and tracksets for teams, clubs, schools and businesses. Made in Nepal.' },
    },
  },
  { timestamps: true },
);
export const SiteSettings = model('SiteSettings', siteSettingsSchema);

export async function getSiteSettings() {
  const existing = await SiteSettings.findById('site');
  if (existing) return existing;
  return SiteSettings.create({ _id: 'site' });
}
