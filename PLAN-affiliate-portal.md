# Affiliate Portal — Plan

affiliates.fatexia.com / publishers.fatexia.com. Vite + React SPA, same monorepo shape as the Admin portal (shared `packages/ui`, `packages/types`). This is the one portal cpatracker actually finished wiring to its real backend (auth, offers, dashboard, reports, messages, news) — worth treating that integration as the template for "what wired-up looks like," while still not copying its code directly (see PLAN.md cross-cutting decisions on the mock-data trap).

## Navigation (from cpatracker's affiliate menu — used as a feature/IA checklist, rebuilt fresh)

- Dashboard
- Offers — Browse, Request Access, Tracking Link, Smart-Links
- Reports — Performance, Clicks, Conversions *(no money/revenue reports — see rule below)*
- Payments
- Messages
- News
- Referral Program
- Profile
- Postback Setup
- Logout

## Hard rule: affiliates never see revenue or profit

cpatracker's affiliate menu was deliberately built payout-only, with an explicit note that revenue/profit must never surface here. Carry this forward exactly: every report, dashboard tile, and offer listing in this portal shows payout/commission numbers only. Revenue and profit are Admin-only data (see PLAN-admin.md, PLAN-backend.md).

## Features

- **Offers**: browse available offers (revenue/commission hidden per the rule above), request access to gated offers, get a tracking link with the `{click_id}` macro pre-filled, use smart links.
- **Reports**: performance/clicks/conversions filtered by date/offer, matching the subset of the Admin portal's reporting that's payout-relevant.
- **Payments**: view payout history/status (per PLAN-backend.md's Conversion status lifecycle: `PENDING`/`APPROVED`/held-until-hold-days-elapse/`PAID`, plus `REJECTED`/`DUPLICATE`/`CHARGEBACK`). Payment method is a self-service setting, launch scope is bank transfer + PayPal only — crypto is explicitly out of scope for v1 on both the affiliate-payout and advertiser-prepay sides (see PLAN.md resolved decisions, superseding the earlier "don't assume it applies" note). Default payout policy (Net-30 batch, $50 minimum, admin-triggered) lives in PLAN-backend.md and still needs real sign-off before it's built.
- **Points**: read-only view of their own `affiliate-points` balance (see PLAN-backend.md) — informational/leaderboard, not redeemable for cash. Likely surfaces as a Dashboard tile or a line on Profile rather than its own nav item, since it's not an action surface.
- **Referral Program**: affiliate refers another affiliate, tracked via the Backend's `affiliates.referredBy` field.
- **Profile**: self-service edit (name, company, country, phone), but cannot reassign their own manager — that's admin-only (see PLAN-admin.md).
- **Postback Setup**: self-service postback URL configuration, so the affiliate's own tracking system gets pinged on conversions.
- **Messages/News**: same realtime (Socket.IO) channel and content source as the Admin portal.

## Dependency

Needs the Backend's `auth`, `offers`, `affiliates`, `clicks`/`conversions` (read-side), `messages`, and `news` modules functional before this portal can be wired to real data — matches the suggested build order in PLAN.md (Backend → Tracker → Admin → Affiliate portal). Payments and Points additionally need `invoices`/payout and `affiliate-points` respectively (see PLAN-backend.md) — lower priority than the rest since they depend on the not-yet-signed-off payout policy.
