/**
 * Demo data for development. `npm run seed` seeds an empty database;
 * `npm run seed -- --reset` wipes the database first.
 */
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import mongoose, { Types } from 'mongoose';
import { env } from './config/env';
import { User } from './models/user.model';
import { Customer } from './models/Customer';
import { Order } from './models/Order';
import { Payment } from './models/Payment';
import { InventoryItem, StockMovement, INVENTORY_CATEGORIES } from './models/Inventory';
import { Counter } from './models/Counter';
import { getSettings } from './models/Settings';
import { computeStatus } from './lib/workflow';
import { STAGES, type Stage } from './lib/constants';
import { ensureSystemRoles } from './lib/roles';

export const DEMO_PASSWORD = 'Password@123';

const DEMO_USERS = [
  { name: 'S. Shrestha', username: 's.shrestha', email: 'owner@sstextiles.com', role: 'owner' },
  { name: 'M. Lama', username: 'm.lama', email: 'design@sstextiles.com', role: 'design' },
  { name: 'K. Rai', username: 'k.rai', email: 'cutting@sstextiles.com', role: 'cutting' },
  { name: 'R. Singh', username: 'r.singh', email: 'printing@sstextiles.com', role: 'printing' },
  { name: 'P. Gurung', username: 'p.gurung', email: 'stitching@sstextiles.com', role: 'stitching' },
  { name: 'B. Thapa', username: 'b.thapa', email: 'finishing@sstextiles.com', role: 'finishing' },
  { name: 'Accounts Desk', username: 'accounts.desk', email: 'accounts@sstextiles.com', role: 'accounts' },
] as const;

type SeedOrder = {
  no: number; customer: string; team: string; qty: number; product: string; stage: Stage;
  dueIn: number; rate: number; paid: number; neck: string; sleeve: string; version: number; approved: boolean;
  feedback?: string; createdDaysAgo: number;
};

const PRODUCTS = {
  full: 'Full sublimation jersey with plain shorts',
  fb: 'Front + back sublimation jersey with plain shorts',
  front: 'Front sublimation jersey with plain shorts',
  fullSet: 'Full sublimation jersey and full sublimation shorts',
};

const ACTIVE_ORDERS: SeedOrder[] = [
  { no: 26113, customer: 'Gandaki Sports', team: 'Gandaki Sports', qty: 21, product: PRODUCTS.full, stage: 'stitching', dueIn: 8, rate: 1800, paid: 12000, neck: 'IPL neck', sleeve: 'Full sleeve', version: 1, approved: true, createdDaysAgo: 14 },
  { no: 26114, customer: 'Makwanpur United', team: 'Makwanpur United', qty: 17, product: PRODUCTS.fb, stage: 'design', dueIn: 7, rate: 1600, paid: 0, neck: 'Band neck', sleeve: 'Half sleeve', version: 2, approved: false, createdDaysAgo: 9 },
  { no: 26115, customer: 'Chitwan Eleven', team: 'Chitwan Eleven', qty: 19, product: PRODUCTS.full, stage: 'printing', dueIn: 6, rate: 1800, paid: 15000, neck: 'Round neck', sleeve: 'Half sleeve', version: 1, approved: true, createdDaysAgo: 12 },
  { no: 26116, customer: 'Janakpur Athletic', team: 'Janakpur Athletic', qty: 15, product: PRODUCTS.front, stage: 'ready', dueIn: -1, rate: 1400, paid: 21000, neck: 'Polo neck', sleeve: 'Full sleeve', version: 1, approved: true, createdDaysAgo: 20 },
  { no: 26117, customer: 'Butwal Strikers', team: 'Butwal Strikers', qty: 24, product: PRODUCTS.full, stage: 'stitching', dueIn: 3, rate: 1800, paid: 20000, neck: 'V neck', sleeve: 'Half sleeve', version: 2, approved: true, createdDaysAgo: 15 },
  { no: 26118, customer: 'Dharan City FC', team: 'Dharan City', qty: 12, product: PRODUCTS.full, stage: 'delivered', dueIn: -3, rate: 1800, paid: 21600, neck: 'Round neck', sleeve: 'Half sleeve', version: 2, approved: true, createdDaysAgo: 22 },
  { no: 26119, customer: 'Biratnagar Rangers', team: 'B. Rangers', qty: 20, product: PRODUCTS.fb, stage: 'design', dueIn: 5, rate: 1500, paid: 10000, neck: 'IPL neck', sleeve: 'Full sleeve', version: 0, approved: false, createdDaysAgo: 4 },
  { no: 26120, customer: 'Lalitpur Sports Club', team: 'Lalitpur SC', qty: 14, product: PRODUCTS.full, stage: 'printing', dueIn: 4, rate: 1800, paid: 0, neck: 'V neck', sleeve: 'Half sleeve', version: 1, approved: true, createdDaysAgo: 10 },
  { no: 26121, customer: 'Everest Academy', team: 'Everest Academy', qty: 30, product: PRODUCTS.front, stage: 'finishing', dueIn: -1, rate: 1400, paid: 42000, neck: 'Band neck', sleeve: 'Half sleeve', version: 2, approved: true, createdDaysAgo: 18 },
  { no: 26122, customer: 'Pokhara United', team: 'Pokhara United', qty: 16, product: PRODUCTS.fullSet, stage: 'stitching', dueIn: 1, rate: 1800, paid: 10000, neck: 'Polo neck', sleeve: 'Full sleeve', version: 1, approved: true, createdDaysAgo: 13 },
  { no: 26123, customer: 'Kathmandu Warriors', team: 'Kathmandu Warriors', qty: 22, product: PRODUCTS.fb, stage: 'printing', dueIn: 0, rate: 1600, paid: 17600, neck: 'Round neck', sleeve: 'Half sleeve', version: 3, approved: true, createdDaysAgo: 11 },
  { no: 26124, customer: 'Himalayan Tigers FC', team: 'Himalayan Tigers', qty: 18, product: PRODUCTS.full, stage: 'design', dueIn: 2, rate: 1800, paid: 12000, neck: 'V neck', sleeve: 'Half sleeve', version: 2, approved: false, feedback: 'Please make the tiger logo slightly bigger on the chest.', createdDaysAgo: 6 },
];

/** Older delivered orders so reports have history. */
const HISTORY_ORDERS: SeedOrder[] = Array.from({ length: 12 }, (_, i) => {
  const customers = ['Dharan City FC', 'Everest Academy', 'Pokhara United', 'Kathmandu Warriors', 'Butwal Strikers', 'Chitwan Eleven'];
  const c = customers[i % customers.length];
  const qty = 12 + ((i * 7) % 20);
  const created = 160 - i * 12;
  return {
    no: 26101 + i, customer: c, team: c, qty, product: Object.values(PRODUCTS)[i % 4], stage: 'delivered', dueIn: -(created - 12),
    rate: 1500 + (i % 3) * 150, paid: i % 5 === 0 ? 10000 : (1500 + (i % 3) * 150) * qty, neck: 'Round neck', sleeve: 'Half sleeve',
    version: 1, approved: true, createdDaysAgo: created,
  };
});

const PLAYERS = [
  ['A. Rai', '07', 'M', 'M'], ['S. Thapa', '10', 'L', 'L'], ['P. Gurung', '23', 'XL', 'L'], ['K. Magar', '01', 'L', 'L'],
  ['N. Tamang', '04', 'M', 'M'], ['R. Shrestha', '09', 'S', 'S'], ['B. Karki', '11', 'L', 'M'], ['D. Limbu', '14', 'XL', 'XL'],
];

const INVENTORY = [
  { name: 'Polyester fabric — Navy', sku: 'FAB-NVY-01', category: 'Fabric', unit: 'metres', onHand: 420, reorderLevel: 100 },
  { name: 'Polyester fabric — White', sku: 'FAB-WHT-01', category: 'Fabric', unit: 'metres', onHand: 88, reorderLevel: 100 },
  { name: 'Sublimation paper', sku: 'PRT-PAP-01', category: 'Printing', unit: 'rolls', onHand: 14, reorderLevel: 5 },
  { name: 'Sublimation ink — CMYK set', sku: 'PRT-INK-01', category: 'Printing', unit: 'sets', onHand: 3, reorderLevel: 2 },
  { name: 'Sewing thread — Black', sku: 'THR-BLK-01', category: 'Thread', unit: 'cones', onHand: 32, reorderLevel: 10 },
  { name: 'Packaging bags', sku: 'PKG-BAG-01', category: 'Packaging', unit: 'pieces', onHand: 72, reorderLevel: 100 },
  { name: 'Neck ribbing — Navy', sku: 'TRM-NVY-01', category: 'Trims', unit: 'metres', onHand: 64, reorderLevel: 25 },
];

const daysFromNow = (n: number) => {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + n);
  return d;
};

// ---------- placeholder artwork PNG (no image libraries needed) ----------

function png(width: number, height: number, pixel: (x: number, y: number) => [number, number, number]): Buffer {
  const raw = Buffer.alloc((width * 3 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 3 + 1)] = 0;
    for (let x = 0; x < width; x++) {
      const [r, g, b] = pixel(x, y);
      const o = y * (width * 3 + 1) + 1 + x * 3;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b;
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(zlib.crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 2; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Draws a simple jersey silhouette in the team's colours. */
function jerseyPng(seed: number): Buffer {
  const palettes: [number, number, number][][] = [
    [[23, 61, 53], [216, 232, 220]], [[30, 64, 140], [250, 204, 21]], [[160, 30, 40], [245, 245, 245]],
    [[20, 20, 20], [240, 120, 30]], [[60, 30, 120], [200, 220, 255]], [[0, 120, 90], [255, 255, 255]],
  ];
  const [main, accent] = palettes[seed % palettes.length];
  const bg: [number, number, number] = [243, 245, 241];
  const W = 240, H = 240;
  return png(W, H, (x, y) => {
    const body = x >= 70 && x < 170 && y >= 50 && y < 210;
    const sleeveL = y >= 50 && y < 105 && x >= 30 && x < 70 && y - 50 < (x - 30) * 1.4 + 10;
    const sleeveR = y >= 50 && y < 105 && x >= 170 && x < 210 && y - 50 < (210 - x) * 1.4 + 10;
    const neck = (x - 120) ** 2 + (y - 50) ** 2 < 18 ** 2;
    if (neck) return bg;
    if (body || sleeveL || sleeveR) {
      const stripe = Math.floor((x + y + seed * 9) / 22) % 2 === 0 && body;
      return stripe ? accent : main;
    }
    return bg;
  });
}

function writeArtwork(seed: number, uploaderId: Types.ObjectId) {
  fs.mkdirSync(env.uploadDir, { recursive: true });
  const storedName = `${crypto.randomUUID()}.png`;
  const buf = jerseyPng(seed);
  fs.writeFileSync(path.join(env.uploadDir, storedName), buf);
  return { storedName, originalName: `artwork-v${seed}.png`, mimeType: 'image/png', size: buf.length, kind: 'artwork', uploadedBy: uploaderId };
}

// ---------- seeding ----------

export async function seedIfEmpty() {
  if ((await User.countDocuments()) > 0) return false;
  await seed();
  return true;
}

export async function seed() {
  console.log('Seeding demo data…');
  await ensureSystemRoles();
  await getSettings();
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const users = Object.fromEntries(
    await Promise.all(DEMO_USERS.map(async (u) => [u.role, await User.create({ ...u, passwordHash })] as const)),
  );
  const owner = users.owner;
  const designer = users.design;

  const customerNames = [...new Set([...ACTIVE_ORDERS, ...HISTORY_ORDERS].map((o) => o.customer))];
  const customers = new Map<string, Types.ObjectId>();
  for (const [i, name] of customerNames.entries()) {
    const c = await Customer.create({
      name,
      contactPerson: ['Arjun', 'Bikash', 'Sita', 'Ramesh', 'Kiran', 'Nabin'][i % 6] + ' ' + ['Rai', 'Thapa', 'Gurung', 'Karki'][i % 4],
      phone: `98${String(41000000 + i * 137911).slice(0, 8)}`,
      address: name.split(' ')[0] + ', Nepal',
    });
    customers.set(name, c._id);
  }

  await User.create({
    name: 'Himalayan Tigers FC',
    username: 'himalayan.tigers.fc',
    email: 'tigers@himalayantigers.com',
    role: 'customer',
    customer: customers.get('Himalayan Tigers FC'),
    passwordHash,
  });

  const settings = await getSettings();
  for (const s of [...HISTORY_ORDERS, ...ACTIVE_ORDERS]) {
    const createdAt = daysFromNow(-s.createdDaysAgo);
    const artworks = Array.from({ length: s.version }, (_, i) => ({
      version: i + 1,
      file: writeArtwork(s.no + i, designer._id),
      note: i === 0 ? 'First draft based on reference' : 'Updated as per customer feedback',
      uploadedBy: designer._id,
      uploadedByName: designer.name,
      uploadedAt: new Date(createdAt.getTime() + (i + 1) * 86_400_000),
    }));
    const stageIdx = STAGES.indexOf(s.stage);
    const history = STAGES.slice(0, stageIdx + 1).map((to, i) => ({
      from: i === 0 ? null : STAGES[i - 1],
      to,
      by: owner._id,
      byName: i === 0 ? owner.name : [designer.name, users.cutting.name, users.printing.name, users.stitching.name, users.finishing.name, owner.name][i - 1],
      note: i === 0 ? 'Order registered' : '',
      at: new Date(createdAt.getTime() + i * 2 * 86_400_000),
    }));
    const players = Array.from({ length: Math.min(s.qty, s.no === 26124 ? 8 : 3) }, (_, i) => {
      const p = PLAYERS[i % PLAYERS.length];
      return { name: p[0], number: p[1], sleeve: s.sleeve, jerseySize: p[2], shortsSize: p[3], trouserSize: '' };
    });
    const delivered = s.stage === 'delivered';
    const order = new Order({
      orderNo: `${settings.orderPrefix}-${s.no}`,
      customer: customers.get(s.customer),
      teamName: s.team,
      productConfig: s.product,
      neckType: s.neck,
      shortsColor: s.product.includes('plain shorts') ? 'Black' : '',
      quantity: s.qty,
      dueDate: daysFromNow(s.dueIn),
      unitRate: s.rate,
      totalAmount: s.rate * s.qty,
      amountPaid: Math.min(s.paid, s.rate * s.qty),
      players,
      comments: s.no === 26124 ? 'Sponsor logo on the back, above the number.' : '',
      artworks,
      approval: s.approved
        ? { version: s.version, by: owner._id, byName: 'Customer (confirmed by phone)', onBehalf: true, at: new Date(createdAt.getTime() + 2 * 86_400_000) }
        : undefined,
      feedback: s.feedback ? [{ version: s.version, message: s.feedback, byName: s.customer, at: daysFromNow(-1) }] : [],
      stage: s.stage,
      history,
      delivery: delivered
        ? { deliveredAt: daysFromNow(s.dueIn - (s.no % 3 === 0 ? -1 : 1)), by: owner._id, byName: owner.name, packedQuantity: s.qty, recipient: 'Team manager', method: 'Customer pickup' }
        : undefined,
      createdBy: owner._id,
    });
    order.status = computeStatus(order);
    await order.save();
    await Order.collection.updateOne({ _id: order._id }, { $set: { createdAt } });
    if (order.amountPaid > 0) {
      await Payment.create({ order: order._id, customer: order.customer, amount: order.amountPaid, method: 'Cash', note: 'Advance', receivedAt: createdAt, recordedBy: users.accounts._id });
    }
  }
  await Counter.updateOne({ _id: 'order' }, { $set: { seq: 26124 } }, { upsert: true });

  for (const item of INVENTORY) {
    const doc = await InventoryItem.create({ ...item, category: item.category as (typeof INVENTORY_CATEGORIES)[number] });
    await StockMovement.create({ item: doc._id, type: 'in', change: item.onHand, balanceAfter: item.onHand, note: 'Opening stock', by: owner._id, byName: owner.name });
  }

  console.log(`Seeded ${DEMO_USERS.length + 1} users, ${customers.size} customers, ${ACTIVE_ORDERS.length + HISTORY_ORDERS.length} orders.`);
  console.log(`Demo password for every account: ${DEMO_PASSWORD}`);
}

if (require.main === module) {
  (async () => {
    await mongoose.connect(env.mongoUri);
    if (process.argv.includes('--reset')) {
      await mongoose.connection.dropDatabase();
      console.log('Database reset.');
    }
    await Promise.all(Object.values(mongoose.models).map((m) => m.syncIndexes()));
    const seeded = await seedIfEmpty();
    if (!seeded) console.log('Database already has users — skipping. Use `npm run seed -- --reset` to start over.');
    await mongoose.disconnect();
  })().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
