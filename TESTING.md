# Fatexia — Testing Guide

How to stand the whole project up locally and verify it actually works. Covers: environment
setup, database, all four running services, the automated dev-verification scripts already in
the repo, and a manual checklist per portal. See [PROGRESS.md](PROGRESS.md) for what's built and
[PLAN.md](PLAN.md)/`PLAN-*.md` for the architecture behind it.

---

## 1. Prerequisites

| Tool | Where it's used |
|---|---|
| Node 22–24 | backend engines constraint |
| pnpm | `frontend/` workspace (admin, affiliate, public) |
| Postgres | `backend/.env` → `DATABASE_URL` |
| Redis | `backend/.env` → `REDIS_URL` (proxy-detection cache, click dedup) |

Local dev normally points at a local Postgres (`postgres://postgres:postgres@localhost:5432/fatexia`)
and Redis via WSL. `backend/.env` in this checkout currently points `DATABASE_URL` at a **hosted
Neon database** instead — check which one you're pointed at before running migrations or seeds,
since the two are not interchangeable state.

---

## 2. Environment files

| File | Key vars |
|---|---|
| `backend/.env` | `DATABASE_URL`, `REDIS_URL`, `JWT_*_SECRET`, `CORS_ORIGIN`, `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD` (prod bootstrap only) |
| `frontend/apps/admin/.env` | `VITE_API_URL=http://localhost:4000` |
| `frontend/apps/affiliate/.env` | `VITE_API_URL=http://localhost:4000` |
| `frontend/apps/public/.env.local` | `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_AFFILIATE_PORTAL_URL` |

**Vite bakes `VITE_API_URL` in at build time** — if it's missing or wrong, requests go to
`/undefined/...` (see the Common gotchas section). A `.env` change to a Vite app only takes effect
after restarting `vite` (dev) or rebuilding (prod).

`CORS_ORIGIN` in `backend/.env` must list every frontend origin you're testing from
(`http://localhost:5173,http://localhost:5174,http://localhost:3000` covers admin/affiliate/public
dev servers).

---

## 3. Database: migrate + seed

```bash
cd backend
npm run migration:run     # applies all migrations in src/infra/database/migrations/
npm run seed               # dev/demo data — refuses to run if NODE_ENV=production
```

`npm run seed` (see `src/infra/database/seed/run-seed.ts`) populates every surface the Admin
portal renders: managers, affiliates (ACTIVE/PENDING/BLOCKED), advertisers, offers, ~2,400 clicks
over 60 days with real MaxMind geo, ~125 conversions, invoices, subscriptions, messages,
notifications, news, email templates, integrations (no credentials — those are entered via the
Integrations page). It's idempotent — re-running rewrites the same rows rather than duplicating.

Seeded login credentials (from `credentails.md`, all share one password):

| Role | Email | Password |
|---|---|---|
| Admin | `admin@fatexia.dev` | `ChangeMe123!` |
| Manager | `manager@fatexia.dev` | `ChangeMe123!` |
| Affiliate | `affiliate@fatexia.dev` | `ChangeMe123!` |

For a **production-style** empty database, use `npm run seed:prod` instead — it only creates the
first admin (from `SUPERADMIN_EMAIL`/`SUPERADMIN_PASSWORD`) plus the singleton rows the Admin
portal can't create on its own (network settings, integration placeholders, email templates). It
refuses to overwrite an existing admin, and requires `SUPERADMIN_PASSWORD` to be set when
`NODE_ENV=production` (falls back to `ChangeMe123!` otherwise — change it after first login).

---

## 4. Running everything

Four processes, four ports:

```bash
# Terminal 1 — API (port 4000)
cd backend && npm run dev

# Terminal 2 — Tracker (port 4001) — click redirects, fraud scoring
cd backend && npm run dev:tracking

# Terminal 3 — Admin portal (port 5173)
cd frontend && pnpm --filter admin dev

# Terminal 4 — Affiliate portal (port 5174)
cd frontend && pnpm --filter affiliate dev

# Terminal 5 — Public marketing site (port 3000)
cd frontend && pnpm --filter public-site dev
```

Health check: `curl http://localhost:4000/health`.

---

## 5. Automated verification scripts

All in `backend/scripts/dev/` — not part of the app, but exactly what to run after any backend
change or fresh seed. Point `API_URL` at whichever environment you're checking:

```bash
cd backend

# Every Admin endpoint — logs in as the seeded admin, GETs all ~37 routes, reports status + shape
node scripts/dev/smoke-api.js
API_URL=https://fatexia-api.onrender.com node scripts/dev/smoke-api.js   # against a deploy

# Affiliate money-visibility rule: walks all affiliate-reachable endpoints and fails if any
# revenue/profit/fraud-reasoning field leaks; also confirms admin-only routes 403 for an affiliate
node scripts/dev/audit-affiliate-visibility.js

# Messaging read-state: drives a real exchange between seeded admin and affiliate, asserts
# unread counts move independently per side
node scripts/dev/verify-messaging.js

# Fires a real tracker click and asserts geo, all 8 sub-ids, device parsing, and that a
# second click from the same IP is correctly not counted as unique
node scripts/dev/verify-click-capture.js

# Confirms the configurable blocked-traffic redirect resolves offer override → network
# setting → built-in default
node scripts/dev/verify-blocked-redirect.js

# 28 assertions from the issues.md pass 9-17 (geo, notifications, integrations, etc.)
node scripts/dev/verify-issues-9-17.js

# Row counts per table — sanity check after a seed or migration
node scripts/dev/row-counts.js

# MaxMind sanity check — confirms GeoLite2 City+ASN resolve and the datacenter filter fires
npx tsx scripts/dev/geo-check.ts

# Geo coverage over the seeded clicks table — fails if resolution rate collapses
node scripts/dev/geo-coverage.js
```

These scripts are the fastest way to know "did I break anything" without opening a browser.

---

## 6. Manual checklist — Admin portal (`:5173`)

Log in as `admin@fatexia.dev`. Every one of the 44 nav destinations should render real seeded data
with zero console errors:

- **Dashboard** — 8 stat tiles, revenue-vs-payout trend chart, ranked lists populate.
- **Offers** — All Offers, Create Offer, Categories, CR Optimizer, Smart-Links (create one, verify
  member-offer picker only allows APPROVED offers), Access Requests / Approvals.
- **Affiliates** — All (filter by status/manager), Create, Pending → approve/reject one, Referral
  Program, Groups, Points (adjust a balance, check the ledger entry), Messages (send/receive,
  confirm unread badge clears on open).
- **Advertisers** — All, Create, Pending.
- **Managers** — Create one, confirm self-reporting is rejected.
- **Reports** — all 11 (Performance, Sub-ID, Advanced, per-offer/affiliate/advertiser, the two CR
  optimizers, cross-tab) — apply a date range, export CSV, confirm it matches on-screen totals.
- **Click Logs / Conversions / Postback Logs** — open the detail drawer, confirm full fraud fields
  (IP, ASN, risk score, proxy flags) are visible here (admin-only).
- **Billing** — pending balances, generate an invoice batch, mark one paid, confirm the underlying
  conversions flip to PAID.
- **Settings / Integrations** — save a network setting and reload to confirm it round-trips; save
  a test API key on an integration and use "Test connection".
- **Notifications / News / Email Templates** — mark-all-read, template macro validation (try an
  unknown macro token and confirm it's rejected).

## 7. Manual checklist — Affiliate portal (`:5174`)

Log in as `affiliate@fatexia.dev`. All 14 nav destinations:

- **Dashboard** — payout-only tiles (no revenue/profit anywhere).
- **Offers** — Browse, Request Access, Tracking Link (build one with sub1/sub2/sub3, confirm it
  resolves to the tracker with your own affiliate id, not a macro placeholder), Smart-Links
  (read-only).
- **Reports / Clicks / Conversions** — confirm **no** revenue, profit, ASN, proxy flags, or risk
  score appear anywhere (money-visibility rule — `audit-affiliate-visibility.js` automates this,
  but worth eyeballing once).
- **Payments** — balance, payout history, points ledger; set a crypto payout method and confirm a
  coin/network mismatch (e.g. BTC address on TRC20) is rejected.
- **Messages** — send to your manager, confirm read receipts.
- **Referral Program** — own code visible, referred affiliates listed.
- **Postback Setup** — self-service URL + macro reference.

## 8. Manual checklist — Public site (`:3000`)

No login required for most of it:

- Home, About, Blog, Verticals, Payments, FAQ, Contact, Terms/Privacy/Cookies all render.
- **Register** — two-step affiliate application (personal info → traffic sources/verticals/volume).
  Submit and confirm in the Admin portal that a PENDING affiliate appears with every field
  (company, verticals, monthly volume, referral source, notes) intact.
- **Login** — confirm it calls the real backend (no mock layer, per project convention) and links
  out to the Affiliate portal on success.

## 9. Manual checklist — Tracker (`:4001`)

```bash
curl -i "http://localhost:4001/click?offerId=<seeded-offer-id>&affiliateId=<seeded-affiliate-id>&sub1=test"
```

- Expect a `302` to the offer's `destinationUrl` with `{click_id}` substituted.
- Invalid `offerId` → `404`. Malformed `offerId` → `400`.
- Check the resulting row in Click Logs (Admin) — geo, device, quality status should all be
  populated (`UNSCORED` is expected/correct if no proxy-provider API keys are configured).
- A second click from the same IP+offer within 24h should **not** increment `uniqueClicks`.

---

## 10. Common gotchas

- **`/undefined/...` in a request URL** — `VITE_API_URL` wasn't set when the Vite bundle was
  built. Fix the env var and restart (dev) or redeploy (prod); a running dev server does pick up
  a `.env` change on restart, but a built/deployed bundle needs a full rebuild.
- **`seed:prod` silently does nothing** — it skips bootstrap entirely if *any* admin already
  exists. It won't reset a password.
- **Fresh/empty database** — if `migration:generate` proposes `CREATE TABLE` for every entity,
  the target database has never had migrations applied. Run `npm run migration:run`, not
  `generate`, to apply the existing migration history.
- **Integration API keys** (IPHub, ipapi.is, IPQS) are **database-only**, entered via the
  Integrations page — there is deliberately no env fallback. Don't expect setting them in `.env`
  to do anything.
- **`GEOIP_DB_DIR`** — if `backend/data/geoip/*.mmdb` is missing, geo/ASN fields on clicks are
  just `unknown`; the tracker still runs, so this fails silently rather than erroring.
