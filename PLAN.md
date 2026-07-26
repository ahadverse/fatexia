# Fatexia — Master Plan

For what's actually built vs. still planned, see [PROGRESS.md](PROGRESS.md) — that file tracks verified state, this one tracks architecture/decisions.

Single CPA (cost-per-action) affiliate network. Not multi-tenant — one network, one brand, one Admin portal. Five sub-projects, each with its own plan file in this folder.

Reference project: `e:\Ahad Hossain\Arif vai\cpatracker` — an earlier, more built-out attempt at the same idea, but built as multi-tenant SaaS. Used here only for UI/menu structure and validated architecture patterns (module shape, hot-path tracker design) — not copied wholesale, and its tenant-scoping layer is dropped entirely.

## Domains

| Surface | Domain(s) |
|---|---|
| Public marketing site | Fatexia.com |
| Admin panel | panel.fatexia.com, app.fatexia.com, network.fatexia.com |
| Tracker | track.fatexia.com |
| Affiliate dashboard | affiliates.fatexia.com, publishers.fatexia.com |
| Advertiser dashboard (future) | advertisers.fatexia.com |

## The 5 projects

| # | Project | Plan file | Stack |
|---|---|---|---|
| 1 | Tracker | [PLAN-tracker.md](PLAN-tracker.md) | Node/TypeScript, separate process, own subdomain |
| 2 | Backend | [PLAN-backend.md](PLAN-backend.md) | Node/TypeScript, Express, TypeORM, Postgres, Redis, BullMQ, Socket.IO |
| 3 | Admin (super admin) | [PLAN-admin.md](PLAN-admin.md) | Vite + React SPA |
| 4 | Frontend (public site) | [PLAN-frontend.md](PLAN-frontend.md) | Next.js |
| 5 | Affiliate portal | [PLAN-affiliate-portal.md](PLAN-affiliate-portal.md) | Vite + React SPA |

Advertiser portal is explicitly deferred ("advertise for future" — project-concept.md) — no plan file yet, just noted as a stub in PLAN-admin.md and PLAN-backend.md so the data model doesn't need reshaping later.

## Cross-cutting decisions

- **No multi-tenancy.** No `tenantId` column, no tenant-access guards, no per-tenant billing. This is the single biggest simplification vs. the cpatracker reference.
- **Credentials are admin-only.** All third-party API keys/secrets (SMTP, proxy-detection API, payment processor) are configured through one Admin "Integrations" page — nothing hardcoded, nothing affiliate/advertiser-facing. Consumers resolve keys through `integration-credentials.ts` (**database only**, short TTL cache), never `process.env`. There is no env fallback by design: reading env directly is what made a key saved in the UI have no effect at all, and keeping env as a *fallback* reintroduces the same class of bug from the other side — a stale env value silently shadowing the UI. `MAXMIND_LICENSE_KEY` is the one exception and is not a counterexample: it is consumed by the build script that downloads the `.mmdb` files, never by a running process.
- **No third-party API by default** for fraud/IP scoring — MaxMind GeoLite2 local `.mmdb` + static datacenter/VPN ASN blocklists are the baseline. One narrow, confirmed exception: residential-proxy detection (IPHub → ipapi.is → IPQS cascading fallback, each free-tier, cached 24h, fail-open on exhaustion). Full detail in [PLAN-tracker.md](PLAN-tracker.md).
- **Money integrity rule** (borrowed from cpatracker's validated pattern): payout amount always comes from the offer's own payout rule, never trusted from an inbound postback payload. Conversion revenue/profit is computed live from current rules, never stored as a mutable balance.
- **Realtime messaging** via Socket.IO (confirmed in project-concept.md).
- **Affiliate-facing views never show revenue/profit** — payout amounts only. Admin/network view sees both sides of the margin.
- **No mock data anywhere in this project — hard rule, not a phase.** Every frontend (Admin, Affiliate portal, public site) talks to the real Backend API, always. No fake-API package, no fixture layer standing in for the backend "for now," no placeholder data meant to be swapped later. cpatracker built exactly that kind of swap-later mock layer (`packages/mock`) and only 1 of its 4 portals ever actually got wired to the live backend — the other 3 are permanently stuck on mock data. That failure mode is the reason this rule is absolute: if a screen needs data, the Backend module it depends on gets built first (see build order below), not stubbed. Menus/feature lists from cpatracker are a UI/IA reference only — the actual frontend architecture (data fetching, types, component structure) is designed fresh, not cloned.

## Resolved decisions (defaults — cheap to revise since these are plan docs, not shipped behavior)

- **Crypto payouts** — **reversed 2026-07-26 on request; now built.** Affiliate payout methods are bank transfer, PayPal and crypto (USDT, USDC, BTC, ETH, LTC, TRX). One `CRYPTO` enum value on both `AffiliatePayoutMethod` and the invoice `PaymentMethod`; the coin, network and wallet address live in the existing `payoutDetails` jsonb, so adding a coin is a data change rather than a migration. Coin *and* network are both required and validated as a pair — a wallet is only valid on the chain it was issued for. Advertiser prepay top-up still doesn't apply, since the advertiser portal is deferred.
- **"MarketPlace" admin menu item** — dropped entirely. No concept in project-concept.md maps to it, and there's no second network/tenant to browse in a single-network product. Not carried into PLAN-admin.md's nav.
- **Countries/currencies** — single base currency (USD) at launch; `offers.currency` field already supports per-offer override for future multi-currency, no FX conversion logic needed yet since nothing forces a different display currency. Country scope is unrestricted (global) by default — offers narrow targeting per-offer via `PayoutRule.targeting.countries`, not a network-wide allow/deny list. This is a technical default, not a business/legal decision about which markets Fatexia actually intends to operate in — revisit if that changes.
- **Blog CMS** — no headless CMS. Blog posts are admin-managed content living in the Backend's own `news`-adjacent content module (reuses the same pattern as `news`, one content table with title/slug/body/cover/publishedAt, rendered by the Next.js frontend via ISR) rather than adding a second external content system.

## Known open items (genuinely require your input — not defaulted)

- **Payout policy specifics** — the default proposed in PLAN-backend.md (Net-30 batch cycle, admin-triggered, $50 minimum threshold, hold-days gate) is a placeholder shaped like industry norm, not a confirmed business rule. Needs your sign-off before the `invoices`/payout module is built for real.
- **KYC / tax documentation** (W9/W8-BEN, ID verification) for affiliate payouts — not addressed anywhere; this is a compliance question tied to real jurisdictions and real money, which isn't something to default silently. Needs an explicit decision (and likely non-Claude legal input) before enabling real bank/PayPal payouts.
- **GDPR/CCPA applicability** — PLAN-frontend.md now specs the technical mechanism (cookie consent banner, disclosure in Privacy Policy), but whether Fatexia is legally obligated to it depends on which regions you actually target — that's a business/legal call, not a technical default.
- Full list of supported countries/currencies *as a business decision* (which markets to actually operate in) — distinct from the technical default above, which just describes what the schema supports.

## Deployment & infra

Not covered anywhere before this pass — kept intentionally light since hosting provider/vendor choice is your call, not something to invent without a stated preference:

- Each of the 5 surfaces deploys independently behind its own subdomain (see Domains table above) — no shared build/release step between them.
- A reverse proxy terminates TLS at the edge in front of all subdomains (e.g. Nginx or Caddy + Let's Encrypt) — the app processes themselves don't handle certs.
- Postgres and Redis are shared services reachable only by the Backend and Tracker processes — never exposed to, or connected from, any frontend.
- Three environments: local dev / staging / production, `.env`-per-environment (prod fail-fast on weak secrets/CORS is already implemented per PROGRESS.md).
- No CD/auto-deploy pipeline defined yet — deploys are manual until there's a concrete need to automate.

## Testing strategy

- Unit tests co-located per module (`<feature>.test.ts`, per the module pattern in PLAN-backend.md) covering service-layer business logic — especially the money-integrity path (payout computed from rule, never from payload) and the offer activation gate.
- Integration tests for the two flows that most need to never silently break: `auth` (register → login → refresh → /me) and the Tracker's `/click` → fraud-score → redirect → logged-row pipeline.
- No mandated browser E2E suite yet — manual Playwright passes (as already done for the Admin portal per PROGRESS.md) are the bar until there's enough surface area to justify automating it.
- A module isn't "done" until its critical-path tests exist, even if the manual E2E pass is green — vitest is already installed/configured per PROGRESS.md, just unused so far.

## Suggested build order

1. **Backend** core modules (auth, users, offers, affiliates, offer-caps) — nothing else can be tested without this.
2. **Tracker** — click → redirect → fraud-score → log pipeline, since it's the product's core value.
3. **Admin portal** — needed to create/manage offers and affiliates before there's anything for affiliates to see.
4. **Affiliate portal** — wire to the real backend (cpatracker's own experience: this was the only portal that got fully integrated, which validates doing it early).
5. **Public site** — can be built in parallel by anyone else, since it has no dependency on the backend beyond the register→redirect handoff.
