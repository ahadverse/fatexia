# Tracker — Plan

track.fatexia.com. Node/TypeScript, its own process, deployable independently from the main backend (same language as the backend so one team can maintain both, but architecturally separate so click-traffic load never touches the admin/affiliate panels). This mirrors cpatracker's `tracking.ts` split, which held up well under review: single indexed PK read, in-memory fraud scoring, buffered async writes — no blocking DB work on the hot path.

## Endpoints

- `/click` — the core redirect: resolve offer/affiliate from click params, run the fraud pipeline, log the click, 302 to the offer's destination URL with `{click_id}` substituted in.
- `/postback` — inbound conversion pings from advertiser tracking platforms (Direct/Affise/HasOffers/Cake/Other), verified against the offer's postback secret and allowed-IP list.
- `/sl` — smart link resolution (single link that rotates to the best-matching live offer for the visitor).

## Fraud pipeline

Layered, weighted scoring — not hard binary gates at each stage (a hard block at every layer produces false positives that burn advertiser trust; a score threshold with a "hold for review" middle band is safer for a network you don't want to over-block).

```
Click
  │
  ├─ 1. MaxMind GeoLite2 local .mmdb (City + ASN) ─────────── $0, local
  ├─ 2. Static datacenter/VPN ASN blocklist (e.g. X4BNet's
  │     maintained lists), refreshed on a schedule ────────── $0, local
  ├─ 3. JS fingerprint signal (navigator.webdriver, WebGL,
  │     languages, phantom checks) — soft signal, not a hard
  │     block (real users on Tor/hardened browsers can fail
  │     WebGL checks; stealth-patched headless browsers can
  │     pass them) ───────────────────────────────────────── $0, client-side
  ├─ 4. Redis cache check (24h TTL) — same IP seen recently? ─ $0, local
  ├─ 5. Residential-proxy detection, cascading fallback,
  │     only reached if 1-4 didn't already resolve it:
  │       a. IPHub.info      (1,000/day)
  │       b. ipapi.is        (1,000/day)
  │       c. IPQualityScore  (1,000/month, reserved as last resort)
  │     Each provider has its own Redis counter with TTL
  │     matching its reset window. If all three are exhausted,
  │     fail-open: allow the click, flag "unscored" for later
  │     batch review — never hard-block due to quota.
  └─ 6. CTIT (click-to-conversion time) scored at conversion
        time, not click time — a conversion under ~1.5s after
        the click is flagged as likely script/bot injection.
        Threshold should be tunable per offer vertical (SDK-
        fired app installs legitimately convert fast).
        │
        ▼
  Weighted fraud score → allow / hold-for-review / block
```

Why the residential-proxy API is the one allowed exception to "no third-party API": datacenter bots are solvable locally because hosting-provider ASNs are a static fact. Residential proxy networks route through real consumer-ISP IPs (Comcast, Jio, etc.) that are indistinguishable from real users by ASN alone — only a live, crowdsourced reputation source catches these, which is exactly what IPHub/ipapi.is/IPQS provide. Nothing else in the pipeline needs a live API call.

## Click data captured

IP, geo, device/OS/browser, ASN, VPN/proxy/bot detection flags, computed risk score, quality status — written to the `clicks` table (owned by the Backend's `clicks` module, but written here on the hot path).

## Performance requirements

- Single indexed primary-key read to resolve offer/affiliate from the click params — no joins on the hot path.
- Fraud scoring happens in-memory; nothing blocks on a synchronous DB write before the redirect fires.
- Click/conversion writes are buffered (Redis or a queue) and flushed asynchronously — the redirect response never waits on a database round-trip.
- Composite indexes needed on the clicks/conversions tables: `(offerId, createdAt)`, `(affiliateId, createdAt)`, `(createdAt)` — no `tenantId` dimension since Fatexia is single-network.

## Click ID & routing

- Click ID generated per click, embedded via the `{click_id}` macro in the offer's destination URL (offers cannot go live without this macro present — see the Backend's offer activation gate).
- Deep linking supported where the offer allows it.
- Smart links resolve to the best-matching live offer rather than one fixed offer.

## Postback verification

Every offer defines a postback secret and an allowed-postback-IP list; inbound postbacks are rejected unless both check out. Once a postback is verified, the *timestamp* is recorded — but the payout **amount** is never taken from the postback payload (see Backend plan's money integrity rule); it's always recomputed from the offer's own payout rule.

## Outbound postback (Fatexia → affiliate)

Separate direction from the above: once a conversion reaches `APPROVED` status, the Tracker (or a queued worker fed by it) fires a postback to the *affiliate's own* registered postback URL (set up self-service in the Affiliate portal, see PLAN-affiliate-portal.md), substituting `{click_id}`/`payout`/`currency`/`status` macros the same way the offer's destination URL does. Delivery is queued (BullMQ) rather than inline on the conversion-processing path, retried up to 3 times with exponential backoff on failure, and every attempt — success or failure — writes a row to the Backend's `postback-logs` table with `direction = OUTBOUND` (see PLAN-backend.md). This was previously undocumented even though `postback-logs` already listed "outbound (to affiliates)" as in scope.
