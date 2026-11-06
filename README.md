# SNS Textiles: Factory Management

## GitHub Actions + PM2 deployment

The repository includes `.github/workflows/deploy.yml`. It type-checks and builds both applications for pull requests and pushes. A push to `main` additionally deploys the checked-out commit to the production server and reloads both PM2 processes from `ecosystem.config.cjs`.

### Server setup

Prepare the server once:

1. Install Node.js 22, Git and PM2.
2. Clone this repository into the deployment directory.
3. Create `backend/.env` with the production API values (`MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGINS`, SMTP settings, and upload settings).
4. Create `frontend/.env.local` with `API_URL=http://127.0.0.1:4000` (or the internal API URL reachable by the Next.js server).
5. Ensure the deployment user can run `pm2` and the repository directory is writable.

The workflow expects these GitHub Actions secrets:

- `DEPLOY_HOST`
- `DEPLOY_USER`
- `DEPLOY_SSH_KEY`
- `DEPLOY_PATH`
- Optional: `DEPLOY_PORT`

The optional repository variable `API_URL` overrides the frontend build-time API URL. Runtime secrets stay on the server and are not stored in GitHub.

Order, production, billing and delivery management for a sportswear (jersey/kit) factory.

- **frontend/**: Next.js 16 (App Router, React 19, TypeScript)
- **backend/**: Node.js + Express 5 + MongoDB (Mongoose 9) + TypeScript

See **[MVP.md](MVP.md)** for the MVP goal, what's included, and the roadmap.

## Quick start (no MongoDB install needed)

Needs Node.js 20+.

```bash
# Terminal 1: API on http://localhost:4000 with an in-memory MongoDB + demo data
cd backend
npm install
npm run dev:memory

# Terminal 2: web app on http://localhost:3000
cd frontend
npm install
npm run dev
```

Open http://localhost:3000 and use one of the demo buttons on the sign-in page.
Every demo account uses the password **`Password@123`**:

| Role | Email |
|---|---|
| Owner / Admin | owner@sstextiles.com |
| Designer | design@sstextiles.com |
| Printing | printing@sstextiles.com |
| Stitching | stitching@sstextiles.com |
| Finishing | finishing@sstextiles.com |
| Accounts | accounts@sstextiles.com |
| Customer (Himalayan Tigers FC) | tigers@himalayantigers.com |

> `dev:memory` data is lost when the API stops. Use a real MongoDB for anything you want to keep.

## Running with a real MongoDB

1. Install MongoDB locally or create a MongoDB Atlas cluster.
2. `cd backend && cp .env.example .env` (already done once) and set `MONGODB_URI` and a long random `JWT_SECRET`.
3. Seed demo data once (optional): `npm run seed` (or `npm run seed -- --reset` to wipe and reseed).
4. `npm run dev`

## Production build

```bash
cd backend && npm run build && npm start      # set NODE_ENV=production, JWT_SECRET, MONGODB_URI
cd frontend && npm run build && npm start     # set API_URL if the API is not on localhost:4000
```

The browser only talks to the Next.js origin; `/api/*` is proxied to the Express API
(`frontend/next.config.ts`), so the session cookie stays first-party and httpOnly.
Uploaded files are stored in `backend/uploads/` (configurable via `UPLOAD_DIR`) and are only
served through the API after a permission check. Back this folder up together with the database.

## How the workflow works

```
Design & confirmation ──(customer approves latest artwork)──▶ Printing ──▶ Stitching ──▶ Finishing ──▶ Ready ──(owner confirms dispatch)──▶ Delivered
```

- The **design team** uploads artwork versions; the **customer** approves or requests changes
  (the owner can record a phone/WhatsApp approval on their behalf; this is audit-logged).
- Each **department** can only complete its own stage; the owner can complete any stage or send a job back for rework.
- **Production roles never see prices.** Customers only ever see their own orders.
- Every critical action (orders, approvals, stage moves, payments, invoices, deliveries, stock, users) is written to the audit log.

## Public website & online shop

The public site (`frontend/src/app/(site)`) replaces the old WordPress/WooCommerce store at snstextiles.com:
shop with search, category filters, price range and sorting; product pages with sizes, neck/sleeve options,
team names & numbers and reviews; cart; checkout; customer accounts; order tracking; custom-jersey and contact
forms; blog; CMS pages (About, policies…); FAQ; `sitemap.xml` and `robots.txt`. Old WordPress URLs
(`/product-category/…`, `/store`, `/blogs`, `/my-account`, root-level blog posts) redirect to their new addresses.

**Checkout creates real production orders.** A signed-in customer's cart becomes one factory order per cart line
(source `website`), priced from the catalogue on the server. Uploaded designs become order reference files, the size
breakdown and names/numbers become the player roster, and an optional advance with a payment screenshot is recorded
as a pending payment for accounts to verify. From there the normal design → approval → production → delivery workflow
applies, and customers follow it in the portal.

**Website management** is in the portal sidebar under *Website* (permissions `site.view`, `site.manage`,
`site.enquiries`; the owner always has them): overview, website orders, products, categories, enquiries,
pages & blog, reviews, newsletter subscribers and website settings (contact details, homepage hero/banner/story,
FAQs, testimonials, gallery, checkout rules, payment instructions, SEO).

Set `NEXT_PUBLIC_SITE_URL` (default `https://snstextiles.com`) for the sitemap and sharing links.

### Moving the catalogue from WooCommerce

1. In WordPress: *Products → All Products → Export* (all columns, all products) to CSV.
2. Optionally download `/product-sitemap.xml` (and `product-sitemap2.xml`, …) so each product keeps its old URL.
3. Portal → *Website → Products → Import from WooCommerce*, upload the files. Re-running updates instead of duplicating.
4. Click *Download old images* to copy product photos off WordPress before switching it off.

Policy pages (privacy, terms, shipping & returns, size guide) are created as drafts — write and publish them under
*Website → Pages & blog*.

## Project layout

```
backend/src
  app.ts                 Express app: security middleware + route mounting
  index.ts / dev-memory.ts   Entry points (real MongoDB / in-memory)
  seed.ts                Demo data
  config/env.ts          Environment configuration
  lib/                   Shared helpers: constants (roles, stages, sizes…), http errors, uploads, mail, urls, counters
  middleware/            Auth (JWT cookie, role guard) and error handling
  features/<area>/       One folder per area. Each request flows route → controller → service → model:
                           <area>.route.ts       URL + permission/upload middleware → controller
                           <area>.controller.ts  reads the request (ids, body via validation), sends the response
                           <area>.service.ts     business rules and database work; returns plain data
                           <area>.validation.ts  zod schemas and input types
                           <area>.model.ts       Mongoose schemas owned by the area
                         Areas:
                           attendance, audit, auth, customers, dashboard, inventory, orders (incl. order.workflow.ts:
                           status rules, approval gate, row-level scoping, serialization), payments, reports, roles,
                           settings (settings + meta routes), site (public website & website management), users
frontend/src
  app/login              Sign-in
  app/(app)/...          Authenticated pages (dashboard, orders, production, customers, inventory, billing, delivery, reports, users, activity, settings)
  app/invoice/[id]       Printable quotation / invoice
  components/            App shell, auth context, modals, UI primitives
  lib/                   API client, types, formatting helpers
```

## API overview

All endpoints are under `/api` and require a session except `/api/auth/login` and `/api/health`.

| Method & path | Who |
|---|---|
| `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `POST /auth/change-password` | anyone / signed in |
| `GET /dashboard` | all (scoped) |
| `GET /orders`, `GET /orders/:id` | all (scoped by role) |
| `POST /orders` (multipart: `data` JSON + `jerseyImage` + `files[]`) | owner, accounts, customer |
| `PATCH /orders/:id`, `POST /orders/:id/invoice` | owner, accounts |
| `DELETE /orders/:id`, `POST /orders/:id/send-back`, `POST /orders/:id/deliver` | owner |
| `POST /orders/:id/artworks` (multipart `file`) | owner, design |
| `POST /orders/:id/approve` | customer, owner |
| `POST /orders/:id/feedback` | customer, design, owner |
| `POST /orders/:id/advance` | owner or the department for the current stage |
| `GET /orders/:id/files/:name` | anyone who can see the order |
| `GET/POST/PATCH/DELETE /customers` | owner, accounts (delete: owner) |
| `GET /payments`, `POST /payments`, `DELETE /payments/:id` | owner/accounts/customer (read), owner/accounts (create), owner (delete) |
| `/inventory/items`, `/inventory/items/:id/movements`, `/inventory/movements` | staff (item create/edit and count adjustments: owner) |
| `GET /reports/summary`, `GET /reports/orders.csv` | owner, accounts |
| `/users` | owner |
| `GET /settings`, `PUT /settings` | all / owner |
| `GET /audit` | owner |
| `GET /meta` | all (option lists) |
