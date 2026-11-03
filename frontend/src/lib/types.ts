export type Role = string;
export type Permission =
  | 'dashboard.view' | 'orders.view' | 'orders.create' | 'orders.update' | 'orders.delete' | 'orders.artwork.upload' | 'orders.approve' | 'orders.feedback' | 'orders.stage.complete' | 'orders.send_back' | 'orders.deliver' | 'orders.invoice'
  | 'customers.view' | 'customers.manage' | 'customers.delete' | 'payments.view' | 'payments.record' | 'payments.delete'
  | 'inventory.view' | 'inventory.manage' | 'inventory.move' | 'inventory.adjust' | 'reports.view' | 'users.manage' | 'settings.view' | 'settings.manage' | 'audit.view'
  | 'roles.manage' | 'profile.manage' | 'account.delete' | 'attendance.view' | 'attendance.checkin' | 'attendance.checkout' | 'attendance.approve';

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
  customer: { id: string; name: string; phone?: string };
  teamName: string;
  productConfig: string;
  neckType: string;
  shortsColor: string;
  quantity: number;
  dueDate: string;
  players: Player[];
  playerListMode?: 'manual' | 'image';
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
}
