# Admin (Super Admin) — Plan

panel.fatexia.com / app.fatexia.com / network.fatexia.com. Vite + React SPA, same monorepo shape as the Affiliate portal (shared `packages/ui`, `packages/types`) — but built against the real backend from day one, not cpatracker's mock-data-layer approach (see PLAN.md cross-cutting decisions).

Single portal for the whole network — cpatracker split this into two apps (`super-admin` for cross-tenant platform ops, `network-admin` for running one network) because it was multi-tenant SaaS. Fatexia has no other tenants to manage, so those two menus are merged into one here, with the purely cross-tenant item (Tenants management) dropped.

## Navigation (merged from cpatracker's two admin menus, tenant-specific items removed)

- **Dashboard**
- **Manage**
  - Offers — Create, All, CR Optimizer, Affiliate×Offer CR, Smart-Links, Approvals, Access Requests, Categories
  - Affiliates — Create, All, Pending, Referral Program, Groups, CR Optimizer, All Affiliate Points, Messages
  - Advertisers *(future — stub nav item only, no working pages yet)* — Create, All, Pending, Messages
  - Managers — Create, Affiliate/Account/General Managers
- **Analyse**
  - Reports — Performance, Clicks, Conversions, Sub-ID Tracking, Postback Logs, Offer/Affiliate/Advertiser/Conversion Reports, Advanced Reports, Click Logs, Affiliate/Advertiser Postback Logs
- **Others**
  - Notifications
  - Settings — currency, hold days, SMTP, rate limits
  - Billing / Invoices
  - Subscriptions *(future — tied to advertiser)*
  - Email Templates
  - News
  - Integrations — third-party API configuration (proxy-detection API keys, SMTP creds, payment processor) — this is where "all credentials handled by admin" lives
  - Logout

Dropped from the cpatracker reference:
- **Tenants (All Tenants, Create Tenant)** — cross-tenant platform ops, not applicable to a single network. Dropped entirely.
- **MarketPlace** — appeared in cpatracker's network-admin menu with no clear definition found and no concept in project-concept.md maps to it. Resolved: dropped entirely, not carried into the nav above (see PLAN.md resolved decisions).

## What this portal does

- Full offer lifecycle: create/update with nested payout rules & caps, status changes gated by the activation check (valid destination URL + verified postback), category management, access-request approval.
- Full affiliate lifecycle: create (provisions login + profile), approve/suspend, edit profile, reassign manager, update postback URL, bulk-target via affiliate groups.
- Manager accounts: staff who get assigned to affiliates/offers as a manager (affiliate manager, account manager, general manager) — a lighter-privilege role than full admin, worth a real permission check rather than a cosmetic label.
- Reporting: the 13-item report menu is the single biggest feature surface here — plan this as one reporting module with shared filter/export components (date range, offer, affiliate, geo) rather than 13 one-off pages.
- CR Optimizer (Offers and Affiliates variants) and Affiliate×Offer CR: read-only analytics views, not separate write-capable modules — computed live from `clicks`/`conversions` aggregates (conversion rate = conversions/clicks, windowed), same "no stored mutable balance" philosophy as everything else money-adjacent. Offers CR Optimizer surfaces offers whose CR has dropped meaningfully vs. their trailing baseline (candidates to pause/investigate) or is anomalously high (possible fraud). Affiliates CR Optimizer is the same idea per-affiliate. Affiliate×Offer CR is the cross-tab of both — which affiliates convert well on which offers — useful input for access-request approvals and manager commission decisions. None of these were previously defined anywhere despite being in the nav since the first draft.
- All Affiliate Points: admin view/adjust of the `affiliate-points` ledger (see PLAN-backend.md) — informational/leaderboard only, no cash redemption exists or is planned.
- Integrations page: where every third-party credential in the system gets configured — proxy-detection API keys, SMTP, MaxMind license (if using a licensed GeoIP2 update vs GeoLite2), payment processor. Nowhere else in the system should have a place to enter secrets.
- Realtime: Notifications and the Affiliates→Messages item both need the Socket.IO channel shared with the Affiliate portal.

## Security note

This is the one portal with access to money-moving actions (approve payouts, edit payout rules, configure payment integrations) and all credentials — role/permission checks here matter more than anywhere else in the system. Worth a real permission model (not just "is admin") from the start, since Managers are a lesser-privileged role sharing this portal. See PLAN-backend.md's "Permission model" section for the concrete Admin-vs-Manager capability matrix — Managers are scoped to their assigned affiliates/offers and are locked out of Integrations, staff management, payout runs, and network settings.

## Design direction (read directly from cpatracker's affiliate + network-admin apps — UI/visual only, not their code or mock-data architecture)

cpatracker's design is genuinely solid and worth carrying forward as-is for this portal:

- **Visual direction**: dark-first dashboard ("Trakaff-style"), shadcn/ui + Tailwind CSS, restrained neutral palette with one accent color. Light mode exists only as a secondary toggle target, not an equally-designed alternative — dark is the primary experience.
- **Token system**: all colors as HSL CSS variables (`--background`, `--foreground`, `--card`, `--border`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--success`, `--warning`, `--info`, plus a `-foreground` pairing for each), defined once and never hardcoded in components. cpatracker's actual values (near-black `240 10% 6%` background, indigo/violet `243 75% 65%` primary) are a reasonable starting point but should be swapped for Fatexia's own brand hue rather than reused verbatim.
- **Shell layout**: fixed left sidebar (grouped sections with uppercase labels, icon + label per item, collapsible to icon-only, active-state highlight, nested/expandable sub-items) + topbar (mobile menu toggle, theme toggle, notifications bell with unread-count badge and dropdown, user menu dropdown) + scrollable main content area. Sidebar becomes an overlay drawer on mobile.
- **Component inventory to build in a shared package**: StatCard (label + big value + up/down delta arrow), StatusBadge (pill, semantic color per variant: neutral/success/warning/destructive/info), DataTable, Chart (line trend, e.g. "Revenue vs Payout, 14 days"), a "ranked list" card pattern (Top Offers/Top Affiliates/Top Advertisers), Modal, Drawer, Tabs, Skeleton loading states, ConfirmModal.
- **Dashboard composition pattern**: stat-card grid at top → trend chart → 2-3 ranked-list cards side by side → a pending-items list (e.g. pending invoices) at the bottom. Admin's dashboard shows Revenue + Payout + Profit tiles (unlike the Affiliate portal, which is payout-only per the money-visibility rule).
- **Quality floor to hold**: responsive down to mobile, visible keyboard focus rings, `prefers-reduced-motion` respected, empty states and loading skeletons on every data screen, plain active-voice copy ("Save changes," not "Submit").
- **Not being carried forward**: the `packages/mock` fake-API layer and its "components never import fixtures directly, only mock/api functions" discipline — that pattern is *why* only 1 of cpatracker's 4 portals ever got wired to a real backend. Fatexia's Admin portal calls the real Backend API from the start (see PLAN.md).
