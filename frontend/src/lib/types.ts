export type Role = string;
export type Permission =
  | 'dashboard.view' | 'orders.view' | 'orders.create' | 'orders.update' | 'orders.delete' | 'orders.artwork.upload' | 'orders.approve' | 'orders.feedback' | 'orders.stage.complete' | 'orders.send_back' | 'orders.deliver' | 'orders.invoice'
  | 'customers.view' | 'customers.manage' | 'customers.delete' | 'payments.view' | 'payments.record' | 'payments.verify' | 'payments.delete'
  | 'inventory.view' | 'inventory.manage' | 'inventory.move' | 'inventory.adjust' | 'reports.view' | 'users.manage' | 'settings.view' | 'settings.manage' | 'audit.view'
  | 'roles.manage' | 'profile.manage' | 'account.delete' | 'attendance.view' | 'attendance.checkin' | 'attendance.checkout' | 'attendance.approve'
  | 'site.view' | 'site.manage' | 'site.enquiries';

export interface RoleDefinition {
  key: Role;
  name: string;
  description: string;
  permissions: Permission[];
  system: boolean;
}
export type Stage = 'design' | 'printing' | 'stitching' | 'finishing' | 'ready' | 'delivered';

export interface Me {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  phone: string;
  avatarUrl: string;
  customer: { id: string; name: string } | null;
}

export interface Meta {
  roles: RoleDefinition[];
  stages: { key: Stage; label: string }[];
  productConfigs: string[];
  neckTypes: string[];
  sleeves: string[];
  sizes: string[];
  paymentMethods: string[];
  deliveryMethods: string[];
  inventoryCategories: string[];
  permissions: Permission[];
  availablePermissions: Permission[];
}

export interface Settings {
  businessName: string;
  logoUrl: string;
  address: string;
  phone: string;
  email: string;
  panNumber: string;
  currency: string;
  timezone: string;
  orderPrefix: string;
  invoicePrefix: string;
  dueSoonDays: number;
  auditRetentionDays: number;
  invoiceFooter: string;
}

export interface StoredFile {
  storedName: string;
  originalName: string;
  mimeType: string;
  size: number;
  kind: 'jersey' | 'reference' | 'player-list' | 'artwork';
  uploadedAt: string;
  url: string;
}

export interface Player {
  name: string;
  number: string;
  sleeve: string;
  jerseySize: string;
  shortsSize: string;
  trouserSize: string;
}

export interface Order {
  id: string;
  orderNo: string;
  source?: 'portal' | 'website';
  productName?: string;
  checkoutRef?: string;
  shipping?: { method: string; recipient: string; phone: string; address: string; city: string } | null;
  customer: { id: string; name: string; phone?: string };
  teamName: string;
  productConfig: string;
  neckType: string;
  shortsColor: string;
  quantity: number;
  dueDate: string;
  players: Player[];
  playerListMode?: 'manual' | 'image';
  cuttingStatus: 'pending' | 'completed';
  cuttingCompletedAt: string | null;
  comments: string;
  files: StoredFile[];
  artworks: { version: number; file: StoredFile; note: string; uploadedByName: string; uploadedAt: string }[];
  currentVersion: number;
  approved: boolean;
  approval: { version: number | null; byName: string; onBehalf: boolean; at: string | null };
  feedback: { version: number; message: string; byName: string; at: string }[];
  stage: Stage;
  stageLabel: string;
  status: string;
  history: { from: Stage | null; to: Stage; byName: string; note: string; at: string }[];
  delivery: {
    deliveredAt: string | null;
    byName: string;
    packedQuantity: number | null;
    recipient: string;
    method: string;
    trackingRef: string;
    note: string;
  };
  createdAt: string;
  updatedAt: string;
  // Finance fields (owner, accounts, customer only)
  unitRate?: number;
  totalAmount?: number;
  amountPaid?: number;
  balance?: number;
  invoice?: { number: string | null; issuedAt: string | null };
}

export interface Customer {
  id: string;
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  panNumber: string;
  notes: string;
  orderCount: number;
  activeOrders: number;
  orderValue: number;
  paid: number;
  outstanding: number;
}

export interface Payment {
  id: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
  receivedAt: string;
  order: { id: string; orderNo: string };
  customer: { id: string; name: string };
  recordedBy: string;
  status: 'pending' | 'verified' | 'rejected' | 'reversed';
  verifiedBy: string | null;
  verifiedAt: string | null;
  rejectionReason: string;
  reversalReason?: string;
  reversedBy?: string | null;
  reversedAt?: string | null;
  proof: { originalName: string; size: number; url: string } | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  sku: string;
  category: string;
  unit: string;
  onHand: number;
  reorderLevel: number;
  active: boolean;
  lowStock: boolean;
  supplier: { id: string; name: string } | null;
}

export interface Supplier {
  id: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  panNumber?: string;
}

export interface StockMovement {
  id: string;
  item: { id: string; name?: string; sku?: string; unit?: string };
  type: 'in' | 'out' | 'adjust';
  change: number;
  balanceAfter: number;
  order: { id: string; orderNo: string } | null;
  note: string;
  byName: string;
  createdAt: string;
}

export interface UserRow {
  id: string;
  name: string;
  username: string;
  email: string;
  role: Role;
  phone: string;
  active: boolean;
  customer: { id: string; name: string } | null;
  lastLoginAt: string | null;
}

export interface AuditEntry {
  id: string;
  actorName: string;
  actorRole?: string;
  action: string;
  entity?: string;
  summary: string;
  at: string;
}

export type AttendanceStatus = 'pending' | 'approved' | 'rejected';

export interface AttendanceRecord {
  id: string;
  user: { id: string; name: string; email: string; role: Role | string };
  checkInAt: string;
  checkOutAt: string | null;
  status: AttendanceStatus;
  approvedAt: string | null;
  approvedBy: { id: string; name: string } | null;
  rejectionReason: string;
  createdAt: string;
  workedMinutes?: number;
}

// ---------- public website ----------

export type StockStatus = 'in_stock' | 'made_to_order' | 'out_of_stock';
export type ShopSize = 'XS' | 'S' | 'M' | 'L' | 'XL' | '2XL' | '3XL' | '4XL';
export const SHOP_SIZES: ShopSize[] = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL'];

export interface SiteCategory {
  id: string;
  name: string;
  slug: string;
  parent: string | null;
  description: string;
  image: string;
  sortOrder: number;
  showOnHome: boolean;
  published: boolean;
  productCount?: number;
}

export interface SiteProduct {
  id: string;
  name: string;
  slug: string;
  sku: string;
  shortDescription: string;
  description: string;
  features: string[];
  images: string[];
  tags: string[];
  categories: { id: string; name: string; slug: string }[];
  price: number;
  salePrice: number | null;
  finalPrice: number;
  productConfig: string;
  neckTypes: string[];
  sleeves: string[];
  sizes: ShopSize[];
  colors: { name: string; hex: string }[];
  allowPersonalisation: boolean;
  allowDesignUpload: boolean;
  minQuantity: number;
  stockStatus: StockStatus;
  featured: boolean;
  ratingAvg: number;
  ratingCount: number;
  seoTitle: string;
  seoDescription: string;
  createdAt: string;
  // admin only
  published?: boolean;
  sortOrder?: number;
  salesCount?: number;
  wooId?: number | null;
}

export interface SitePage {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  published: boolean;
  showInFooter: boolean;
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}

export interface SitePost {
  id: string;
  title: string;
  slug: string;
  excerpt: string;
  content?: string;
  coverImage: string;
  tags: string[];
  authorName: string;
  published: boolean;
  publishedAt: string;
  seoTitle: string;
  seoDescription: string;
  updatedAt: string;
}

export interface SiteReview {
  id: string;
  name: string;
  rating: number;
  body: string;
  createdAt: string;
  email?: string;
  status?: 'pending' | 'approved' | 'rejected';
  product?: { id: string; name: string; slug: string } | null;
}

export interface SiteEnquiry {
  id: string;
  type: 'custom' | 'contact';
  name: string;
  email: string;
  phone: string;
  team: string;
  product: string;
  quantity: number | null;
  neededBy: string | null;
  subject: string;
  message: string;
  status: 'new' | 'in_progress' | 'closed';
  notes: string;
  createdAt: string;
  files: { originalName: string; size: number; mimeType: string; url: string }[];
}

export interface SiteLink { label: string; href: string }

export interface SiteSettings {
  brandName: string;
  tagline: string;
  announcement: string;
  announcementRight: string;
  contact: { phones: string[]; email: string; whatsapp: string; address: string; openingHours: string; mapEmbedUrl: string };
  social: { facebook: string; instagram: string; tiktok: string; youtube: string };
  hero: { kicker: string; titleLine1: string; titleLine2: string; subtitle: string; primaryCta: SiteLink; secondaryCta: SiteLink; image: string };
  banner: { kicker: string; title: string; highlight: string; subtitle: string; cta: SiteLink; image: string };
  story: { kicker: string; title: string; body: string };
  faqs: { q: string; a: string }[];
  testimonials: { name: string; role: string; quote: string }[];
  gallery: string[];
  checkout: { minLeadDays: number; deliveryMethods: string[]; deliveryNote: string; paymentInstructions: string };
  seo: { title: string; description: string };
  updatedAt?: string;
}
