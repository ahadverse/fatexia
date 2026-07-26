# Backend — Plan

Node.js + TypeScript + Express + TypeORM + Postgres. Redis for caching/queues, BullMQ for background jobs, Socket.IO for realtime messaging, JWT + bcrypt for auth, Zod for validation, pino for logging. Same core stack as the `cpatracker` reference project, minus its entire tenant layer.

## Module pattern (borrowed from cpatracker, keep as-is — it held up well under review)

Each feature is one module under `src/modules/<feature>/`, as flat suffixed files (verified directly against cpatracker's `offers` module — not subfolders):

```
<feature>.entity.ts       TypeORM entity — no business logic
<feature>.repository.ts   query methods only — no raw SQL, no business logic
<feature>.service.ts      all business logic lives here
<feature>.controller.ts   thin — try/catch/next, no logic, ~15 lines
<feature>.routes.ts       route wiring
<feature>.dto.ts          Zod schemas for request validation
<feature>.test.ts         co-located test file
```

A module can have more than one entity file when it owns child records (cpatracker's `offers` module also has `payout-rule.entity.ts` and `offer-cap.entity.ts` alongside `offer.entity.ts`), and can include a focused standalone helper file for one specific piece of logic (e.g. `targeting-match.ts` + its own `.test.ts`) rather than stuffing everything into the service file.

Rules to keep enforcing:
- Controllers never contain business logic — that's a service's job.
- No raw SQL in services — go through the repository.
- No `synchronize: true` — migrations only, always.
- Don't let build-plan jargon (sprint/track/stage names) leak into permanent code comments — a comment should explain *why*, not which phase of a plan wrote it. Use a CHANGELOG or ADRs for that history instead.
- Avoid duplicating payout-rule/cap construction logic between create and update paths (cpatracker's `offer.service.ts` had ~30 duplicated lines here) — factor into one shared builder function used by both.

## Module list

No `tenants` module, no `tenantId` column anywhere, no tenant-access guard helpers — single network, so nothing is scoped beyond the app itself.

**Users & Access**
- `auth` — login, JWT issue/refresh, password reset
- `users` — accounts, roles, login status
- `login-logs` — IP, user agent, success/fail
- `staff` — admin/manager accounts (the single Admin portal's own users, distinct from affiliates/advertisers)
- `managers` — affiliate managers / account managers / general managers, assignable to affiliates and offers

**Offers & Payouts**
- `offers` — see field list below
- `offer-categories`
- `offer-access-requests` — affiliate requests access to a gated offer; admin approves/rejects
- `smart-links` — single link that rotates to a best-matching offer
- Payout rules and offer caps are child records of `offers` (not separate top-level modules), per the field spec below

**Affiliates**
- `affiliates`
- `affiliate-groups` — bulk offer-targeting groups

**Advertisers (future — stub only, don't build yet)**
- `advertisers`, `advertiser-subscriptions` — placeholder modules so the schema doesn't need reshaping when this is picked up later

**Traffic & Conversions (core tracking data — written by the Tracker service, read/reported on here)**
- `clicks` — IP, geo, device/OS/browser, ASN, VPN/proxy/bot flags, risk score, quality status
- `conversions` — revenue, payout, profit, status, duplicate/orphan flags, lead risk, email/phone hash validation
- `postback-logs` — inbound (from advertiser tracking platforms) and outbound (to affiliates), payload, success/error

**Fraud**
- `fraud` — scoring engine (consumes MaxMind local data + static lists + cached proxy-API results — see [PLAN-tracker.md](PLAN-tracker.md) for the actual pipeline, this module is the config/rules side)
- `fraud-config` — thresholds, block/hold/allow bands
- `geo-source` — wraps the local MaxMind `.mmdb` lookups

**Money**
- `invoices` / `billing` — advertiser billing (future) and affiliate payout batches, see Payout policy below
- `affiliate-points` — informational-only loyalty ledger, see below. Not a currency, not redeemable — kept out of the money-integrity surface entirely.
- Payment method / payout config — crypto is out of scope for v1 on both sides (see PLAN.md resolved decisions); launch methods are bank transfer + PayPal only

**Reporting**
- `reports` — performance, clicks, conversions, sub-ID tracking, postback logs, per-offer/affiliate/advertiser breakdowns
- `dashboard` — aggregated summary views per portal

**Comms & Content**
- `messages` — support/messaging (Socket.IO realtime)
- `notifications`
- `news` — announcements
- `email-templates` — transactional trigger templates

**Platform config**
- `network-settings` — currency, hold days, SMTP, rate limits
- `integrations` — third-party API configuration page (proxy-detection API keys, SMTP, payment processor) — admin-only, per the "all credentials handled by admin" rule

## Data model detail (from project-concept.md / user spec)

**Offer** — id, name, preview link, description, KPI, category, icon, start/end date, default payout amount, currency, status (Pending/Approved/Rejected/Paused/Deleted), tracking platform (Direct/Affise/HasOffers/Cake/Other), traffic types, featured flag, network offer ID, auto-approve conversions, allow deep linking, admin/manager remarks, destination URL (must include `{click_id}`), postback secret, allowed postback IPs, postback verified timestamp.

Activation gate: an offer cannot go Approved/live without a valid destination URL and a verified postback.

**Payout Rule** (per offer) — payout mode (CPA/CPC/CPL/CPI/CPS), payout type (flat/%), amount, revenue model & amount, targeting (countries/devices/affiliates/affiliate groups), manager commission %, referral commission %, hold enabled/days.

**Offer Cap** — period (daily/weekly/monthly/overall) × metric (clicks/conversions/payout) × limit.

**Offer Category** — name.

**Offer Access Request** — offer + affiliate + status (pending/approved/rejected).

**Affiliate** — id, linked user account, name, company, country, postback URL, referred-by, assigned affiliate manager, registration info (JSON), status (Active/Pending/Suspended — derived from the linked user account).

**Affiliate Group** — name + member affiliate IDs.

**Click** — id, offerId, affiliateId, ip, UA-parsed device/os/browser, countryCode, asn, isDatacenter, isProxyOrVpn (nullable), riskScore, qualityStatus (GOOD/SUSPECT/BLOCKED/UNSCORED), createdAt. Written by the Tracker (see PLAN-tracker.md), owned/read here.

**Conversion** — id, clickId, offerId, affiliateId, revenueAmount, payoutAmount (always recomputed from the offer's `PayoutRule` at write time, never trusted from the postback payload — see Money integrity rule), status, isDuplicate, isOrphan (no matching click), leadRiskScore, emailHash/phoneHash (for duplicate detection without storing raw PII redundantly), ctitMs (click-to-conversion time, feeds the CTIT fraud signal), approvedAt, paidAt, createdAt.

Status lifecycle: `PENDING` (received, not yet evaluated) → `APPROVED` (passed fraud/duplicate checks) → `PAID` (included in a completed payout batch). Side branches from `PENDING`/`APPROVED`: `REJECTED` (failed validation) and `DUPLICATE` (matched an existing conversion) are terminal negative states. `CHARGEBACK` is a post-`PAID` reversal state for advertiser-disputed conversions. Hold days (network- or offer-level setting) gate the `APPROVED` → eligible-for-payout transition: a conversion isn't included in a payout batch until `approvedAt + holdDays <= now`, giving a window to catch fraud/chargebacks before money moves.

**Postback Log** — id, conversionId (nullable for inbound logs that didn't resolve), direction (INBOUND/OUTBOUND), payload (raw JSON), success, errorMessage, attemptCount, createdAt. Inbound = advertiser tracking platform → Fatexia (verified against offer's postback secret + allowed-IP list, per PLAN-tracker.md). Outbound = Fatexia → affiliate's own postback URL, fired on conversion status transitions the affiliate cares about (at minimum on `APPROVED`), with the same `{click_id}`-style macro substitution the destination URL uses, plus `payout`/`currency`/`status`. Outbound delivery is queued (BullMQ) rather than fired inline, retried up to 3 times with exponential backoff, and every attempt (success or failure) lands a row here regardless of retry outcome.

**Affiliate Points** — id, affiliateId, conversionId (nullable, for manual admin adjustments), points, reason, createdAt. Earned automatically per `APPROVED` conversion at a configurable rate (network-wide default, optional per-offer override), or adjusted manually by an admin with a required reason string. Purely informational/leaderboard — no redemption mechanism exists or is planned; if points-to-cash redemption is ever wanted, that's a new decision requiring its own money-integrity review, not an extension of this ledger.

## Payout policy (proposed default — needs your sign-off, see PLAN.md open items)

- **Methods at launch**: bank transfer + PayPal only, selected per-affiliate as a profile setting. No crypto (see PLAN.md resolved decisions).
- **Minimum threshold**: $50 accumulated approved-and-unheld payout balance before a payout is issued, configurable in `network-settings`.
- **Schedule**: Net-30 batch cycle by default — an admin-triggered payout run picks up every conversion where `status = APPROVED` and `approvedAt + holdDays <= now`, groups by affiliate, and marks the batch `PAID` once processed. No fully-automated (unattended) payout run planned — an admin always triggers the batch.
- **Not yet decided**: KYC/tax documentation requirements before releasing real payouts (see PLAN.md open items — this is a compliance question, not a technical default).

## Permission model (Admin vs Manager)

Referenced as a gap in PLAN-admin.md's security note — the two roles that share the Admin portal need distinct capability boundaries, not just a cosmetic label difference:

| Capability | Admin | Manager |
|---|---|---|
| View/edit offers, affiliates assigned to them | ✓ | ✓ (assigned only, via `managers.reportsToId`/assignment) |
| View/edit offers, affiliates *not* assigned to them | ✓ | ✗ |
| Approve/reject offer access requests, affiliate applications | ✓ | ✓ (assigned only) |
| Create/edit other staff (admin or manager) accounts | ✓ | ✗ |
| Integrations page (all third-party credentials) | ✓ | ✗ |
| Trigger payout batches | ✓ | ✗ |
| Network settings (currency, hold days, SMTP, rate limits) | ✓ | ✗ |

Enforced the same way `requireRole` already gates ADMIN/MANAGER/AFFILIATE at the route level (see PROGRESS.md) — the assignment scoping (Manager sees only their own affiliates/offers) is a service-layer filter on top of that, not a new guard mechanism.

## Rate limits (network-settings default)

- `/auth/login` — limited per-IP and per-account, to blunt credential stuffing (specific numbers are a `network-settings` admin-configurable value, not hardcoded).
- Tracker's `/click` and `/postback` — limited per-IP, since these are the two public, unauthenticated hot-path endpoints most exposed to abuse/scraping. Kept generous enough not to interfere with legitimate ad-network traffic spikes.
- No rate limit on authenticated Admin/Affiliate portal API calls beyond normal abuse protection — these are behind login already.

## Fraud-config score bands (starting default, tunable — see PLAN-tracker.md pipeline)

Weighted contributions feeding the score in PLAN-tracker.md's pipeline: datacenter/hosting ASN match +40, static VPN/proxy blocklist match +30, residential-proxy API positive +35, JS fingerprint fail +15 (soft signal, capped low deliberately since it's the least reliable input), CTIT < 1.5s +50 (applied at conversion time, not click time). Bands: 0–30 `GOOD` (allow), 31–70 `SUSPECT` (hold for review), 71+ `BLOCKED`. These are seed values for the `fraud-config` module's thresholds, not hardcoded constants — expect to tune them once real traffic volume exists.

## Transactional emails (email-templates seed list)

Welcome/verify on affiliate register, password reset, offer access request approved/rejected, affiliate account approved/suspended, payout batch sent, offer went live (postback verified → APPROVED). A weekly performance digest is a plausible future addition, not committed yet.

## Core actions

- List/filter offers by advertiser, status, category, traffic type, date; create/update with nested payout rules & caps; change status (gated by activation check); affiliate-facing "available offers" view with revenue/commission hidden; manage categories; request/approve/reject offer access.
- Admin: list/filter affiliates by status/country/date, view detail, create (provisions login + profile), approve/suspend, edit profile, reassign manager, update postback URL.
- Affiliate self-service: view/edit own profile (cannot reassign own manager), update own postback URL.
- Affiliate groups: create/edit/delete/list for bulk offer targeting.

## Money integrity rule (non-negotiable, carried over from cpatracker)

Payout amount is always computed from the offer's own payout rule at conversion time — never trusted from a postback payload, even a verified one. Conversion revenue/profit/status is computed live from current rules; there is no stored mutable "balance" field that could drift from the source data.
