# Public Portal — Build Plan

The conversion-focused marketing site (`frontend/apps/public`, Next.js 15, port 3000, fatexia.com). Supersedes the page-inventory section of [PLAN-frontend.md](PLAN-frontend.md) with the concrete build spec. Goal: a professional, modern, high-converting CPA-network site with the full page/section depth a real network ships — no thin/stub pages.

## Root cause found first (why it looked like "a single div")

`apps/public/src/app/layout.tsx` imports the shared `@fatexia/ui/styles/theme.css`, which sets `html, body, #root { height: 100%; overflow: hidden }`. That is correct for the **dashboard** apps (admin/affiliate scroll inside their own AppShell) but fatal for a marketing site — the body can't scroll, so only the hero viewport is visible. Fix: override document scrolling in the public app's own `globals.css` (loaded after theme.css, so it wins). This is the first task.

## Honesty constraint (brand + [[project_no_mock_data]])

Fatexia's entire positioning is transparency ("built to show its work"). Fatexia is also new/pre-launch. So the site must **not fabricate a track record** — no invented "$40M paid", "12,000 affiliates", fake advertiser logos, or fake named testimonials. Proof points are **capability-based and true**: in-house tracker, 3-layer fraud pipeline, payout terms, verticals supported, payment methods, traffic sources supported. Hand-authored marketing copy (vertical descriptions, value props) is content — fine, same status as the hand-authored blog posts — but hard performance metrics presented as fact are not.

## Design system

Dark-first (tokens already in `packages/ui` theme.css — indigo/violet primary, hue 243). Layer on top, in the public app only:
- **Backgrounds**: deep near-black + radial indigo glows + subtle grid/dot pattern overlays.
- **Type**: Inter via `next/font/google`, tight tracking on display headings, gradient-text accent on hero headlines.
- **Components**: eyebrow labels, gradient CTA buttons, cards with hover lift + border-glow, consistent section rhythm (py-24/32, max-w-6xl/7xl).
- **Motion**: subtle CSS scroll-reveal + float/shimmer keyframes; respect `prefers-reduced-motion`.
- All colors from existing tokens — no hardcoded hex.

## Shared building blocks (build once, compose everywhere)

- `src/lib/content.ts` — shared marketing content: features, verticals, steps, faqs, payment methods, traffic sources, capability stats. Reused across home + dedicated pages.
- `src/components/marketing.tsx` — presentational library: `Button`, `Eyebrow`, `SectionHeading`, `GradientText`, `FeatureCard`, `VerticalCard`, `StatBand`, `LogoCloud`, `StepList`, `CTABanner`, `Section`.
- `src/components/FAQAccordion.tsx` — client accordion.
- `src/components/Reveal.tsx` — client scroll-reveal wrapper.
- Rebuild `Navbar` (solutions dropdown + mobile menu) and `Footer` (richer, full sitemap).

## Page inventory

| Route | Purpose |
|-------|---------|
| `/` | Home — 12 rich sections (hero, traffic-source bar, capability stats, features, verticals, how-it-works, fraud deep-dive, "built different" comparison, payments, affiliate/advertiser split, FAQ, final CTA) |
| `/affiliates` | Publisher pitch — value prop, verticals, payouts, how-to-join, FAQ, CTA |
| `/advertisers` | Advertiser pitch — quality/anti-fraud angle, marketing-only (portal deferred, matches stub pattern) |
| `/verticals` | All verticals with detail cards |
| `/payments` | Payout methods + terms (Net-X), currencies |
| `/faq` | Full categorized FAQ |
| `/contact` | Contact options — honest (mailto + direct channels), no faked backend success |
| `/about` | Company / mission / how the network is built — richer rebuild |
| `/blog`, `/blog/[slug]` | Keep (hand-authored posts); restyle to match new system |
| `/register`, `/login` | Keep real backend wiring; restyle to match |
| `/terms`, `/privacy` | Keep; light polish |
| `/cookies` | New — Cookie Policy (pairs with tracking disclosure in PLAN-frontend.md) |

## Execution order

1. Fix scroll bug + author enriched `globals.css` (patterns, gradients, keyframes).
2. Inter font in `layout.tsx`.
3. `content.ts` + `marketing.tsx` + `FAQAccordion` + `Reveal`.
4. Rebuild Navbar + Footer.
5. Rebuild Home.
6. Build affiliates, advertisers, verticals, payments, faq, contact, cookies; rebuild about.
7. Restyle register/login to the new system.
8. `pnpm --filter public-site typecheck` + live smoke test on :3000.

## Verify

Typecheck clean; every route returns 200 and renders full-length (scrolls); zero console errors; dark theme consistent; responsive (no horizontal body scroll). Update [PROGRESS.md](PROGRESS.md) Public-site section when done.
