/**
 * Drives the real factory-management app through each feature and saves screenshots of every step to
 * studio/shots, together with manifest.json: the on-screen box of each element the videos point at.
 *
 * Run it against the demo build with fresh seed data:
 *   backend:  APP_URL=http://localhost:3123/portal npx tsx src/dev-memory.ts
 *   frontend: npx next build && npx next start -p 3123
 *   here:     APP_URL=http://localhost:3123/portal MONGO_URI=mongodb://127.0.0.1:<port>/ss_textiles npm run capture
 *
 * MONGO_URI is optional; with it, two weeks of attendance history are seeded so the calendar has data.
 * The flows change data (they create an order, record a payment, ...), so restart the API before re-running.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { launch, sleep } from './browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'studio', 'shots');
const APP = (process.env.APP_URL ?? 'http://localhost:3123/portal').replace(/\/$/, '');
const API = `${APP}/api`;
const PASSWORD = process.env.DEMO_PASSWORD ?? 'Password@123';
const ONLY = process.argv[2] ? process.argv[2].split(',') : null;

const USERS = {
  owner: 'owner@sstextiles.com',
  design: 'design@sstextiles.com',
  printing: 'printing@sstextiles.com',
  customer: 'tigers@himalayantigers.com',
};

const DESKTOP = { width: 1440, height: 900, deviceScaleFactor: 2 };
const MOBILE = { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true };

fs.mkdirSync(OUT, { recursive: true });
const manifestPath = path.join(OUT, 'manifest.json');
const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};

// ---------------------------------------------------------------- page helpers

async function session(browser, who, viewport = DESKTOP) {
  const context = await browser.createBrowserContext();
  const page = await context.newPage();
  await page.setViewport(viewport);
  page.on('pageerror', (e) => console.warn(`  [${who}] page error: ${e.message}`));
  // Hide the text caret and freeze CSS transitions so screenshots are crisp and repeatable.
  await page.evaluateOnNewDocument(() => {
    const style = () => {
      const s = document.createElement('style');
      s.textContent = '*{caret-color:transparent!important;scrollbar-width:none!important}*::-webkit-scrollbar{display:none!important}';
      document.head.appendChild(s);
    };
    if (document.head) style(); else document.addEventListener('DOMContentLoaded', style);
  });
  await page.goto(`${APP}/login`, { waitUntil: 'networkidle0', timeout: 120000 });
  const status = await page.evaluate(async (identifier, password) => {
    const r = await fetch('/portal/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, credentials: 'include', body: JSON.stringify({ identifier, password }) });
    return r.status;
  }, USERS[who], PASSWORD);
  if (status !== 200) throw new Error(`Login failed for ${who} (${status})`);
  return page;
}

async function go(page, route) {
  await page.goto(`${APP}/${route.replace(/^\//, '')}`, { waitUntil: 'networkidle0', timeout: 120000 });
  await settle(page);
}

async function settle(page, extra = 350) {
  await page.waitForNetworkIdle({ idleTime: 350, timeout: 20000 }).catch(() => {});
  await page.evaluate(async () => {
    await Promise.all([...document.images].filter((i) => !i.complete).map((i) => new Promise((r) => { i.onload = i.onerror = r; })));
    await document.fonts.ready;
  });
  await sleep(extra);
}

/** Finds the smallest visible element matching `selector` whose text contains `text`. */
async function find(page, selector, text = '', within = null) {
  const handle = await page.evaluateHandle((selector, text, within) => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    const visible = (e) => e.getClientRects().length > 0;
    const smallest = (list, t) => list.filter((e) => visible(e) && (!t || norm(e.textContent).includes(t))).sort((a, b) => a.textContent.length - b.textContent.length)[0] ?? null;
    let root = document;
    if (within) {
      root = smallest([...document.querySelectorAll(within[0])], within[1]);
      if (!root) return null;
    }
    return smallest([...root.querySelectorAll(selector)], text);
  }, selector, text, within);
  const el = handle.asElement();
  if (!el) throw new Error(`Not found: ${selector} "${text}"${within ? ` within ${within.join(' ')}` : ''}`);
  return el;
}

/**
 * Finds the `selector` element (with `text`) that sits closest to some text `anchor`, e.g. the
 * "Mark stage complete" button on the card for SS-26120. Returns [element, container card].
 */
async function near(page, selector, text, anchor) {
  const handle = await page.evaluateHandle((selector, text, anchor) => {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    let best = null;
    for (const el of document.querySelectorAll(selector)) {
      if (!el.getClientRects().length || (text && !norm(el.textContent).includes(text))) continue;
      let up = el;
      while (up && !up.textContent.includes(anchor)) up = up.parentElement;
      if (up && (!best || up.textContent.length < best[1].textContent.length)) best = [el, up];
    }
    return best;
  }, selector, text, anchor);
  const [el, container] = await Promise.all([handle.evaluateHandle((b) => b?.[0] ?? null), handle.evaluateHandle((b) => b?.[1] ?? null)]);
  if (!el.asElement()) throw new Error(`Not found: ${selector} "${text}" near ${anchor}`);
  return [el.asElement(), container.asElement()];
}

/** The input/select inside the form field whose label starts with `label`. */
async function field(page, label, root = 'body') {
  const handle = await page.evaluateHandle((label, root) => {
    const scope = [...document.querySelectorAll(root)].at(-1) ?? document;
    const f = [...scope.querySelectorAll('.field')].find((x) => x.querySelector('label, :scope > span')?.textContent.trim().startsWith(label));
    return f?.querySelector('input, select, textarea') ?? null;
  }, label, root);
  const el = handle.asElement();
  if (!el) throw new Error(`Field not found: ${label}`);
  return el;
}

async function box(el) {
  const r = await el.evaluate((e) => { const b = e.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
  return Object.fromEntries(Object.entries(r).map(([k, v]) => [k, Math.round(v)]));
}

async function boxes(map) {
  const out = {};
  for (const [k, el] of Object.entries(map)) if (el) out[k] = await box(el);
  return out;
}

async function snap(page, name, targets = {}, { full = false } = {}) {
  await settle(page, 250);
  const vp = page.viewport();
  const file = `${name}.png`;
  await page.screenshot({ path: path.join(OUT, file), fullPage: full });
  const size = full ? await page.evaluate(() => ({ w: document.documentElement.scrollWidth, h: document.documentElement.scrollHeight })) : { w: vp.width, h: vp.height };
  manifest[name] = { file, ...size, boxes: await boxes(targets) };
  console.log(`  ✓ ${name}`, Object.keys(manifest[name].boxes).join(' '));
}

async function typeInto(el, text) {
  await el.click({ clickCount: 3 });
  await el.press('Backspace');
  await el.type(String(text), { delay: 8 });
}

async function selectText(el, text) {
  const value = await el.evaluate((s, t) => [...s.options].find((o) => o.textContent.includes(t))?.value, text);
  if (value === undefined) throw new Error(`Option not found: ${text}`);
  await el.select(value);
}

async function scrollTo(page, el, offset = 110) {
  await el.evaluate((e, off) => window.scrollBy(0, e.getBoundingClientRect().top - off), offset);
  await sleep(250);
}

/** Clicks the primary button of the open modal, ticking any checklist boxes first. */
async function confirmModal(page) {
  await page.waitForSelector('.modal', { timeout: 8000 });
  await page.$$eval('.modal input[type=checkbox]', (cs) => cs.forEach((c) => { if (!c.checked) c.click(); }));
  const btn = await find(page, '.modal .btn.primary');
  await btn.click();
  await page.waitForFunction(() => !document.querySelector('.modal'), { timeout: 15000 }).catch(() => {});
  await settle(page);
}

async function api(page, route, init) {
  return page.evaluate(async (url, init) => {
    const r = await fetch(url, { credentials: 'include', ...init });
    return r.json();
  }, `${API}/${route}`, init ?? {});
}

async function orderId(page, orderNo) {
  const data = await api(page, 'orders?limit=200');
  const list = data.orders ?? data.items ?? data;
  const o = list.find((x) => x.orderNo === orderNo);
  if (!o) throw new Error(`Order ${orderNo} not found`);
  return o.id ?? o._id;
}

// ---------------------------------------------------------------- demo data helpers

/** A jersey artwork (front and back) rendered from SVG, used as the new design version in the approval flow. */
function jerseySvg({ primary = '#f28c18', accent = '#111', crest = 'HT', word = 'TIGERS', name = 'THAPA', label = 'Himalayan Tigers FC · v3 · Full sublimation · V neck · half sleeve' } = {}) {
  const shirt = (x, back) => `
    <g transform="translate(${x},70)">
      <path d="M150 0 L250 0 Q260 40 200 55 Q140 40 150 0Z" fill="${accent}"/>
      <path d="M60 30 L150 0 Q200 60 250 0 L340 30 L400 150 L330 185 L320 140 L320 520 L80 520 L80 140 L70 185 L0 150Z" fill="${primary}"/>
      <g fill="${accent}">
        <path d="M80 160 L150 120 L130 230 L80 260Z"/><path d="M320 160 L250 120 L270 230 L320 260Z"/>
        <path d="M80 330 L170 290 L140 380 L80 410Z"/><path d="M320 330 L230 290 L260 380 L320 410Z"/>
        <path d="M80 470 L180 440 L150 520 L80 520Z"/><path d="M320 470 L220 440 L250 520 L320 520Z"/>
      </g>
      <path d="M0 150 L60 30 L40 120Z M400 150 L340 30 L360 120Z" fill="${accent}"/>
      ${back
        ? `<text x="200" y="175" font-family="Arial Black,Arial" font-weight="900" font-size="34" text-anchor="middle" fill="#fff" stroke="${accent}" stroke-width="2">${name}</text>
           <text x="200" y="345" font-family="Arial Black,Arial" font-weight="900" font-size="150" text-anchor="middle" fill="#fff" stroke="${accent}" stroke-width="5">10</text>`
        : `<circle cx="255" cy="175" r="44" fill="#fff" stroke="${accent}" stroke-width="5"/>
           <text x="255" y="190" font-family="Arial Black,Arial" font-weight="900" font-size="38" text-anchor="middle" fill="${primary}">${crest}</text>
           <text x="200" y="330" font-family="Arial Black,Arial" font-weight="900" font-size="44" text-anchor="middle" fill="#fff" stroke="${accent}" stroke-width="2">${word}</text>
           <text x="200" y="420" font-family="Arial Black,Arial" font-weight="900" font-size="64" text-anchor="middle" fill="#fff" stroke="${accent}" stroke-width="3">10</text>`}
    </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="680" viewBox="0 0 1000 680">
    <rect width="1000" height="680" fill="#f5f2ec"/>
    ${shirt(70, false)}${shirt(530, true)}
    <text x="500" y="640" font-family="Arial" font-size="20" text-anchor="middle" fill="#6b6b6b">${label}</text>
  </svg>`;
}

async function renderPng(browser, svg) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 680 });
  await page.setContent(`<body style="margin:0">${svg}</body>`);
  const buf = await page.screenshot({ type: 'png' });
  await page.close();
  return Buffer.from(buf).toString('base64');
}

/** Writes a PNG to studio/.tmp so it can be attached to a file input. */
async function tempPng(browser, name, svg) {
  const dir = path.join(ROOT, 'studio', '.tmp');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, name);
  fs.writeFileSync(file, Buffer.from(await renderPng(browser, svg), 'base64'));
  return file;
}

function receiptSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900">
    <rect width="600" height="900" fill="#fff"/><rect width="600" height="150" fill="#41a124"/>
    <text x="300" y="95" font-family="Arial" font-weight="700" font-size="44" text-anchor="middle" fill="#fff">Payment successful</text>
    <text x="300" y="300" font-family="Arial" font-weight="700" font-size="64" text-anchor="middle" fill="#222">NPR 15,000</text>
    <text x="300" y="380" font-family="Arial" font-size="28" text-anchor="middle" fill="#666">To: Factory account</text>
    <text x="300" y="430" font-family="Arial" font-size="28" text-anchor="middle" fill="#666">Ref: ESW-77120931</text>
  </svg>`;
}

async function seedAttendanceHistory() {
  if (!process.env.MONGO_URI) {
    console.log('  (MONGO_URI not set: skipping attendance history)');
    return;
  }
  const client = await MongoClient.connect(process.env.MONGO_URI);
  const db = client.db();
  const users = await db.collection('users').find({ role: { $nin: ['customer', 'owner'] } }).toArray();
  const owner = await db.collection('users').findOne({ role: 'owner' });
  const NPT = (5 * 60 + 45) * 60_000; // Kathmandu is UTC+05:45
  const docs = [];
  let seed = 7;
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  for (let d = 18; d >= 1; d--) {
    const day = new Date(Date.now() + NPT);
    day.setUTCDate(day.getUTCDate() - d);
    day.setUTCHours(0, 0, 0, 0);
    if (day.getUTCDay() === 6) continue; // Saturday is the weekly holiday
    for (const u of users) {
      if (rand() < 0.08) continue; // the odd day off
      const start = day.getTime() - NPT + (9 * 60 + Math.round(rand() * 35 - 10)) * 60_000;
      const end = start + (8 * 60 + Math.round(rand() * 80)) * 60_000;
      docs.push({ user: u._id, checkInAt: new Date(start), checkOutAt: new Date(end), status: 'approved', approvedAt: new Date(start + 3_600_000), approvedBy: owner._id, rejectionReason: '', createdAt: new Date(start), updatedAt: new Date(end), __v: 0 });
    }
  }
  await db.collection('attendances').deleteMany({}); // start from a clean slate so the flow can be re-run
  await db.collection('attendances').insertMany(docs);
  // Everyone except the printing user (who checks in on camera) is already on shift today.
  const shift = users.filter((u) => u.email !== USERS.printing).map((u, i) => {
    const at = new Date(Date.now() - (150 - i * 7) * 60_000); // checked in earlier today
    return { user: u._id, checkInAt: at, checkOutAt: null, status: i < 2 ? 'approved' : 'pending', approvedAt: i < 2 ? at : null, approvedBy: i < 2 ? owner._id : null, rejectionReason: '', createdAt: at, updatedAt: at, __v: 0 };
  });
  await db.collection('attendances').insertMany(shift);
  await client.close();
  console.log(`  seeded ${docs.length + shift.length} attendance records`);
}

// ---------------------------------------------------------------- flows

const flows = {
  async overview(browser) {
    const page = await session(browser, 'owner');
    await go(page, 'dashboard');
    await snap(page, 'dashboard', {
      create: await find(page, 'a, button', 'Create order'),
      stats: await find(page, '.stats, .stat-grid, .kpi-grid, .grid', 'Active orders'),
      workload: await find(page, '.card', 'Production workload'),
      recent: await find(page, '.card', 'Recent orders'),
    });
    await page.setViewport({ ...DESKTOP, height: 1500 });
    await go(page, 'dashboard');
    await snap(page, 'dashboard-tall');
    for (const route of ['customers', 'delivery', 'activity', 'users', 'settings']) {
      await page.setViewport(DESKTOP);
      await go(page, route);
      await snap(page, route);
    }
    await page.close();
  },

  async orders(browser) {
    const page = await session(browser, 'owner');
    await go(page, 'orders');
    await snap(page, 'orders-list', { create: await find(page, 'a, button', 'Create order'), first: await find(page, 'tbody tr') });

    const jersey = await tempPng(browser, 'ktm-jersey.png', jerseySvg({ primary: '#1f4fa3', accent: '#c8102e', crest: 'KW', word: 'WARRIORS', name: 'THAPA', label: 'KTM Warriors U-19 · Full sublimation · V neck' }));
    const proof = await tempPng(browser, 'esewa-proof.png', receiptSvg());
    await go(page, 'orders/new');
    const customer = await field(page, 'Customer / club');
    const team = await field(page, 'Team name on order');
    const config = await find(page, 'label.checkbox-card', 'Full sublimation jersey and full sublimation shorts');
    await snap(page, 'order-new-0', { customer, team, config });

    await selectText(customer, 'Kathmandu Warriors');
    await typeInto(team, 'KTM Warriors U-19');
    const jerseyInput = await find(page, 'input[type=file]', '', ['.field', 'Jersey image']);
    await jerseyInput.uploadFile(jersey);
    await settle(page, 500);
    await snap(page, 'order-new-1', { customer, team, config });

    await config.click();
    const neck = await field(page, 'Neck type');
    await selectText(neck, 'V neck');
    const qty = await field(page, 'Quantity (sets)');
    await typeInto(qty, 22);
    await snap(page, 'order-new-2', { config, neck, qty });

    const rate = await field(page, 'Unit rate');
    await scrollTo(page, rate, 300);
    await snap(page, 'order-new-3', { rate, advance: await field(page, 'Advance received') });
    await typeInto(rate, 1650);
    await typeInto(await field(page, 'Advance received'), 15000);
    await selectText(await find(page, 'select[aria-label="Advance method"]'), 'eSewa');
    await settle(page, 200);
    await (await find(page, 'input[type=file]:not([disabled])', '', ['.field', 'proof'])).uploadFile(proof);
    await settle(page, 500);
    await snap(page, 'order-new-4', { rate, advance: await field(page, 'Advance received') });

    const players = [['S. Thapa', 10], ['R. Gurung', 7], ['A. Tamang', 9], ['B. Rai', 1], ['K. Magar', 4], ['D. Shrestha', 11]];
    const firstPlayer = await find(page, 'input[aria-label="Player 1 name"]');
    await scrollTo(page, firstPlayer, 260);
    await snap(page, 'order-new-5', { p1: firstPlayer });
    for (const [i, [name, no]] of players.entries()) {
      await typeInto(await find(page, `input[aria-label="Player ${i + 1} name"]`), name);
      await typeInto(await find(page, `input[aria-label="Player ${i + 1} number"]`), no);
    }
    await snap(page, 'order-new-6', { p1: firstPlayer, p6: await find(page, 'input[aria-label="Player 6 name"]') });

    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await sleep(300);
    const submit = await find(page, 'button.btn.primary', 'Create order');
    await snap(page, 'order-new-7', { submit });
    await submit.click();
    await page.waitForFunction(() => /\/orders\/[a-f0-9]{24}$/.test(location.pathname), { timeout: 30000 });
    await settle(page, 800);
    await snap(page, 'order-created', {
      tracker: await find(page, '.card', 'Created'),
      artwork: await find(page, '.card', 'Artwork & approval'),
      billing: await find(page, '.card', 'Billing'),
      title: await find(page, 'h1'),
    });
    await page.close();
  },

  async production(browser) {
    const page = await session(browser, 'owner');
    await go(page, 'production');
    const [btn, cardEl] = await near(page, 'button', 'Mark stage complete', 'SS-26120');
    await snap(page, 'board-0', { btn, card: cardEl });
    await btn.click();
    await page.waitForSelector('.modal', { timeout: 8000 });
    await snap(page, 'board-1', { confirm: await find(page, '.modal .btn.primary') });
    await confirmModal(page);
    const [, movedCard] = await near(page, 'a, button', 'Open job', 'SS-26120');
    await movedCard.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await snap(page, 'board-2', { card: movedCard });

    const id = await orderId(page, 'SS-26121');
    await go(page, `orders/${id}`);
    const complete = await find(page, 'button.btn.primary', 'Complete Finishing');
    await snap(page, 'tracker-0', { complete, tracker: await find(page, '.card', 'Cutting:'), history: await find(page, '.card', 'Stage history') });
    await complete.click();
    await page.waitForSelector('.modal', { timeout: 8000 });
    await snap(page, 'tracker-1', { confirm: await find(page, '.modal .btn.primary') });
    await confirmModal(page);
    await snap(page, 'tracker-2', { tracker: await find(page, '.card', 'Cutting:'), history: await find(page, '.card', 'Stage history'), dispatch: await find(page, 'button', 'Confirm dispatch') });
    await page.close();
  },

  async approval(browser) {
    // The designer uploads version 3 of the artwork, then the customer reviews and approves it.
    const design = await session(browser, 'design');
    const id = await orderId(design, 'SS-26124');
    const png = await renderPng(browser, jerseySvg());
    const uploaded = await design.evaluate(async (url, b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const fd = new FormData();
      fd.append('file', new File([bytes], 'tigers-v3.png', { type: 'image/png' }));
      fd.append('note', 'Bigger tiger crest on the chest as requested');
      const r = await fetch(url, { method: 'POST', credentials: 'include', body: fd });
      return r.status;
    }, `${API}/orders/${id}/artworks`, png);
    if (uploaded >= 300) throw new Error(`Artwork upload failed (${uploaded})`);
    await design.close();

    const page = await session(browser, 'customer');
    await go(page, 'dashboard');
    await snap(page, 'cust-dashboard', { order: await find(page, 'a, tr, .card', 'SS-26124') });
    await go(page, `orders/${id}`);
    const approve = await find(page, 'button', 'Approve v3');
    await snap(page, 'cust-order-0', { approve, artwork: await find(page, '.artwork.current'), changes: await find(page, 'button', 'Request changes') });
    await approve.click();
    await page.waitForSelector('.modal', { timeout: 8000 });
    await snap(page, 'cust-order-1', { confirm: await find(page, '.modal .btn.primary') });
    await confirmModal(page);
    await snap(page, 'cust-order-2', { artwork: await find(page, '.artwork.current'), card: await find(page, '.card', 'Artwork & approval') });
    await page.close();
  },

  async billing(browser) {
    const page = await session(browser, 'owner');
    await go(page, 'billing');
    const customer = await field(page, 'Customer');
    await snap(page, 'billing-0', { customer, stats: await find(page, '.card', 'Order value') });
    await selectText(customer, 'Kathmandu Warriors');
    await settle(page, 600);
    const record = await find(page, 'button', 'Record payment');
    await snap(page, 'billing-1', { customer, summary: await find(page, '.customer-summary'), record, ledger: await find(page, 'button', 'Payment ledger') });
    await record.click();
    await page.waitForSelector('.modal', { timeout: 8000 });
    await settle(page);
    const amount = await field(page, 'Amount', '.modal');
    const method = await field(page, 'Method', '.modal');
    await snap(page, 'billing-2', { amount, method, order: await field(page, 'Order', '.modal') });
    await typeInto(amount, 10000);
    await selectText(method, 'eSewa');
    await typeInto(await field(page, 'Reference', '.modal'), 'ESW-88213064');
    const save = await find(page, '.modal .btn.primary');
    await snap(page, 'billing-3', { amount, method, save });
    await confirmModal(page);
    await settle(page, 600);
    const ledger = await find(page, 'button', 'Payment ledger');
    await snap(page, 'billing-4', { ledger, summary: await find(page, '.customer-summary') });
    await ledger.click();
    await settle(page, 600);
    await snap(page, 'billing-5', {
      table: await find(page, '.billing-results'),
      statement: await find(page, 'button, a', 'Download statement'),
      exportBtn: await find(page, 'button, a', 'Export'),
    });
    await page.close();
  },

  async attendance(browser) {
    await seedAttendanceHistory();
    const staff = await session(browser, 'printing');
    await go(staff, 'attendance');
    const checkIn = await find(staff, 'button', 'Check in');
    await snap(staff, 'att-staff-0', { checkIn, shift: await find(staff, '.shift-card') });
    await checkIn.click();
    if (await staff.$('.modal')) await confirmModal(staff);
    await settle(staff, 700);
    await snap(staff, 'att-staff-1', { shift: await find(staff, '.shift-card') });
    await staff.close();

    const page = await session(browser, 'owner');
    await go(page, 'attendance');
    const today = await find(page, '.chip-btn', 'Today');
    await today.click();
    await settle(page, 600);
    const approve = (await near(page, 'button', 'Approve', 'R. Singh'))[0];
    await snap(page, 'att-owner-0', { approve, today, stats: await find(page, '.card', 'Pending approvals') });
    await approve.click();
    if (await page.$('.modal')) await confirmModal(page);
    await settle(page, 600);
    const month = await find(page, '.chip-btn', 'This month');
    await snap(page, 'att-owner-1', { month, row: await find(page, 'tr', 'R. Singh') });
    await month.click();
    await settle(page, 600);
    const calendarTab = await find(page, 'button', 'Calendar');
    await snap(page, 'att-owner-2', { calendarTab });
    await calendarTab.click();
    await settle(page, 700);
    const calendar = await find(page, '.attendance-calendar');
    await scrollTo(page, calendar, 90);
    await snap(page, 'att-owner-3', { calendar });
    await page.close();
  },

  async inventory(browser) {
    const page = await session(browser, 'owner');
    await go(page, 'inventory');
    const stockIn = (await near(page, 'button', 'In', 'Polyester fabric — White'))[0];
    await snap(page, 'inv-0', { stockIn, alert: await find(page, '.notice, [class*=notice]', 'Reorder needed'), row: await find(page, 'tr', 'Polyester fabric — White') });
    await stockIn.click();
    await page.waitForSelector('.modal', { timeout: 8000 });
    await settle(page);
    const qty = await field(page, 'Quantity', '.modal');
    const ref = await field(page, 'Supplier', '.modal');
    await snap(page, 'inv-1', { qty, ref });
    await typeInto(qty, 300);
    await typeInto(ref, 'Sagar Fabrics · Bill #4471');
    await snap(page, 'inv-2', { qty, ref, save: await find(page, '.modal .btn.primary') });
    await confirmModal(page);
    await settle(page, 600);
    await snap(page, 'inv-3', { row: await find(page, 'tr', 'Polyester fabric — White'), alert: await find(page, '.notice, [class*=notice]', 'Reorder needed').catch(() => null) });
    await page.close();
  },

  async reports(browser) {
    const page = await session(browser, 'owner', { ...DESKTOP, height: 2100 });
    await go(page, 'reports');
    await sleep(800);
    await snap(page, 'reports-tall', {
      chart: await find(page, '.card', 'Order value vs collections'),
      stages: await find(page, '.card', 'Orders by stage'),
      receivables: await find(page, '.card', 'Receivables by customer'),
    });
    await page.close();
  },

  async roles(browser) {
    const page = await session(browser, 'owner');
    await go(page, 'roles');
    const edit = (await near(page, 'button', 'Edit', 'Design team'))[0];
    await snap(page, 'roles-0', { edit, row: await find(page, 'tr', 'Design team') });
    await edit.click();
    await page.waitForSelector('.modal', { timeout: 8000 });
    await settle(page);
    const option = await find(page, '.modal label.permission-option', 'inventory.create');
    await option.evaluate((e) => e.scrollIntoView({ block: 'center' }));
    await sleep(300);
    await snap(page, 'roles-1', { option, modal: await find(page, '.modal') });
    await option.click();
    await snap(page, 'roles-2', { option, save: await find(page, '.modal .btn.primary') });
    await page.close();
  },

  async mobile(browser) {
    const page = await session(browser, 'owner', MOBILE);
    await go(page, 'dashboard');
    await snap(page, 'm-dashboard');
    await go(page, 'production');
    await snap(page, 'm-production');
    const id = await orderId(page, 'SS-26123');
    await go(page, `orders/${id}`);
    await snap(page, 'm-order');
    await go(page, 'billing');
    await snap(page, 'm-billing');
    await page.close();
  },
};

const browser = await launch();
try {
  for (const [name, flow] of Object.entries(flows)) {
    if (ONLY && !ONLY.includes(name)) continue;
    console.log(`▶ ${name}`);
    await flow(browser);
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
    // The studio player loads this from file:// where fetch() is unavailable.
    fs.writeFileSync(path.join(OUT, 'manifest.js'), `window.MANIFEST = ${JSON.stringify(manifest)};\n`);
  }
} finally {
  await browser.close();
}
console.log(`Saved ${Object.keys(manifest).length} shots to ${path.relative(process.cwd(), OUT)}`);
