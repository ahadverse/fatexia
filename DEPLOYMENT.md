# Deployment — Render (backend) + Vercel (frontend)

Five deployable units, not two:

| Unit | Platform | Notes |
|---|---|---|
| `fatexia-api` | Render web service | REST + Socket.IO, port from `PORT` |
| `fatexia-tracker` | Render web service | `/click` redirects — separate process by design |
| Postgres + Redis | Render managed | one database shared by both services |
| `public-site` | Vercel | Next.js 15 |
| `admin`, `affiliate` | Vercel (2 projects) | Vite SPAs, static |

Everything below assumes the repo is on GitHub — **both platforms deploy from git, and this repo currently has no commits at all.** That is step 0.

---

## Before the first push

### 1. Do not commit the MaxMind databases

`backend/data/geoip/` holds ~70 MB of GeoLite2 data. Committing it breaks two things at once: the GeoLite2 licence forbids redistribution, and `GeoLite2-City.mmdb` (57 MB) trips GitHub's 50 MB warning — with a fresh copy every month, history would grow by that much each time.

The root `.gitignore` now excludes them. They are never fetched automatically — neither at build time nor at Tracker startup (both used to re-download on every deploy/restart against Render's ephemeral filesystem and previously hit MaxMind's download rate limit). Instead, an admin fetches them on demand from the Admin panel (Settings → GeoIP Database → "Refresh now"), which calls `POST /geoip/fetch` on the API, which forwards to `POST /internal/geoip/fetch` on the Tracker (see `backend/src/modules/geoip/` and `backend/src/infra/geoip/ensure-geoip.ts`). A Redis-backed cooldown (independent of the container filesystem, since Redis is its own service) refuses a re-download within 24 hours of the last attempt per edition, regardless of how many times it's triggered in that window — this exists to respect MaxMind's own rate limit, not to gate the admin action itself. A persistent Disk mounted at `GEOIP_DB_DIR` lets the downloaded files survive restarts; without one, a restart wipes them and geo/ASN lookups degrade to unknown until the next manual trigger. Verify before pushing:

```bash
git status --porcelain | grep -i mmdb   # must print nothing
```

If `MAXMIND_LICENSE_KEY` is absent, the Tracker still boots — geo/ASN lookups return unknown, which disables the datacenter fraud filter but breaks nothing else. Only the Tracker service needs `GEOIP_DB_DIR`/`MAXMIND_LICENSE_KEY`; the API never reads the `.mmdb` files, but does need `GEOIP_ADMIN_SECRET` to authorize the proxied fetch request (see below).

### 2. Remove the credentials file from the working tree

`credentails.md` is gitignored now, but confirm it was never staged.

---

## Backend — Render

`render.yaml` at the repo root is a Blueprint describing both services, Postgres and Redis. In the Render dashboard: **New → Blueprint → select this repo**.

Then set the values marked `sync: false` (Render will not invent them):

| Variable | Set on | Value |
|---|---|---|
| `CORS_ORIGIN` | both | `https://admin.fatexia.com,https://affiliates.fatexia.com,https://fatexia.com` |
| `PUBLIC_TRACKING_URL` | **API only** | `https://track.fatexia.com` |
| `PUBLIC_API_URL` | **API only** | `https://fatexia-api.onrender.com` (or the API's custom domain) |
| `MAXMIND_LICENSE_KEY` | **Tracker only** | from your MaxMind account |
| `GEOIP_ADMIN_SECRET` | **both** | any long random string — must be the *same* value on both services |

**The proxy-provider keys are not environment variables.** IPHub, ipapi.is and IPQS
are entered in the Admin portal under **Integrations** after the first deploy, and read
from the `integrations` table at request time. There is deliberately no env fallback —
two homes for one credential means one is eventually stale, and it fails silently in
both directions: a key only in env makes the Integrations page look unconfigured while
the provider is being billed, and a key only in the UI appears broken if a stale env
value shadows it. Rotating a key is a form submission, not a redeploy.

`MAXMIND_LICENSE_KEY` is read by the Tracker only when an admin triggers a fetch (see
`ensure-geoip.ts`) — never at build time or startup. Kept a plain env var rather than an
Integrations-table credential like the proxy providers because rotating it is rare
enough that a redeploy to pick up a new value isn't a real cost.

`EMAIL_LOGO_URL` is the wordmark shown in outbound email. It is fetched by the
*recipient's* mail client, so it must be reachable from the public internet — a
localhost URL (the dev default for the API) arrives as a broken image, and a `data:`
URI does not render at all because Gmail strips it. It defaults to an image host
rather than this API so it keeps working regardless of where the API is deployed or
whether a free-tier service is asleep. Keep it the same artwork as
`backend/public/logo.png`: the rendered height is derived from that local file's
aspect ratio.

`CORS_ORIGIN` must be an exact origin list — scheme and host, **no trailing slash**. The app deliberately refuses to boot in production with it empty rather than defaulting to "allow any origin".

### `PUBLIC_TRACKING_URL` — the chicken-and-egg

It looks circular (the API needs the tracker's URL, which doesn't exist until the tracker deploys), but it isn't, for three reasons:

- **The tracker doesn't need it.** Only the API builds tracking links (`offer.dto.ts`, `smart-link.dto.ts`). The tracker just serves `/click` and never needs its own address.
- **It's read per request, not at boot**, and has a working default. A wrong value produces wrong links; it never stops the service starting. Correcting it is a restart, not a rebuild — unlike Vite's `VITE_API_URL`, which is baked in at build time.
- **You already know the final value.** You will point a custom domain at the tracker regardless, so set `https://track.fatexia.com` from the start and configure DNS afterwards. It stays correct even if you rename or rebuild the service.

If you are not using a custom domain yet, the Render hostname follows the service name — `https://fatexia-tracker.onrender.com`. Confirm it on the dashboard after the first deploy, since Render appends a suffix when a subdomain is already taken globally.

A trailing slash is stripped automatically (see `stripTrailingSlash` in `env.ts`) — `https://track.fatexia.com/` would otherwise generate `//click`, which some proxies 404.

### Migrations

They run at start, not at build: Render's build step has no database access. `migration:run:prod` uses the compiled `dist/` data source, so no TypeScript toolchain is needed at runtime. It is idempotent — already-applied migrations are skipped — so running on every boot is safe.

Only `fatexia-api` migrates. The tracker deliberately does not: two services racing to migrate the same database during a simultaneous deploy is how you get a half-applied migration.

### Bootstrapping a fresh database

The Render shell is a paid feature, so on the free plan run this from a laptop with
`DATABASE_URL` pointed at the production database. `DATABASE_SSL=true` is required
because it defaults to on only when `NODE_ENV=production`, and the data source
overrides `?sslmode=require` in the URL rather than honouring it:

```bash
cd backend
DATABASE_SSL=true DATABASE_URL='<prod pooled string>' npm run migration:run
DATABASE_SSL=true DATABASE_URL='<prod pooled string>' \
  SUPERADMIN_EMAIL=you@yourdomain.com SUPERADMIN_PASSWORD='<strong>' npm run seed:prod
```

Migrations come first — `seed:prod` fails on a missing `users` table. Leave `NODE_ENV`
unset: setting it to `production` makes importing `env.ts` fire
`assertSecureProductionSecrets()`, so you would have to supply `JWT_*` and `CORS_ORIGIN`
just to seed. An inline `DATABASE_URL` beats `backend/.env` because `dotenv` never
overrides an already-set variable, so this cannot hit the wrong database by accident.

`seed:prod` is idempotent and inserts no business data — no offers, affiliates, clicks
or conversions. It creates the first admin (never overwriting an existing one), the
`network_settings` singleton from the entity's column defaults, and the rows the Admin
portal can edit but not create: the 7 `integrations` (no credentials) and 8
`email_templates`. Those two tables expose only `PATCH /:id`, so without them the
Integrations page renders an empty list — and since the provider keys deliberately have
no env fallback, proxy detection could never be switched on at all.

Every step is insert-if-missing rather than `save()`, so re-running cannot erase a key
an admin typed into the Integrations page or revert their edited email copy.

**Do not run `npm run seed`** — the dev seed refuses to run with `NODE_ENV=production`, but it is worth knowing why: it would insert 2,400 fake clicks and demo affiliates into your live database. Note that guard keys off `NODE_ENV`, not the database host, so it does **not** protect a production database reached from a laptop where `NODE_ENV` is `development`.

### Two constraints worth knowing now

**Never put the tracker on the free plan.** Free services sleep after ~15 minutes idle and take up to a minute to wake. A click redirect that stalls that long is a lost conversion, and at volume a lost advertiser.

**Realtime is single-instance today.** Socket.IO rooms live in the process memory of one instance. Scaling `fatexia-api` past one instance means two admins can land on different instances and miss each other's message events. The fix is the Redis adapter — Redis is already provisioned:

```bash
npm i @socket.io/redis-adapter
```

then wire it in `socket-server.ts`. Until then, keep that service at one instance.

---

## Frontend — Vercel

Three separate Vercel projects, all pointing at the same repo, each with a different **Root Directory**. This is the part people get wrong: the root directory is the app, but the install has to run at the workspace root so pnpm can link `@fatexia/ui` and `@fatexia/types`. The committed `vercel.json` files already handle that.

| Project | Root Directory | Framework preset |
|---|---|---|
| `fatexia-public` | `frontend/apps/public` | Next.js |
| `fatexia-admin` | `frontend/apps/admin` | Vite |
| `fatexia-affiliate` | `frontend/apps/affiliate` | Vite |

All three now carry their own `vercel.json` with those commands, so nothing needs setting in
project settings beyond the Root Directory. Note the workspace root is `frontend/`, not the
repository root — that is why each config does `cd ../..` rather than relying on Vercel's
monorepo auto-detection, which looks for `pnpm-workspace.yaml` at the repo root and will not
find it here.

**`vercel.json` cannot hold comments.** The schema sets `additionalProperties: false` at the
root and on every `rewrites`/`headers` entry, so a `comment` key fails the deploy with
"Invalid vercel.json" before the build starts. That is why the reasoning behind each rule
lives here instead:

- **The SPA rewrite** — see the section below.
- **`/assets/(.*)` cached immutable for a year** — Vite hashes asset filenames, so the name
  changes whenever the content does and a stale copy can never be served.
- **`/index.html` never cached** — it is the file that points at the current asset hashes, so
  a cached copy pins users to a deleted build. This pairing is why the two rules must both
  exist; either one alone is wrong.
- **`X-Frame-Options: DENY` on admin and affiliate** — both handle money and credentials and
  are never meant to be framed. The public marketing site omits it deliberately.

The public app needs no `outputDirectory`: Next.js writes `.next` where Vercel already looks.
It also needs no `transpilePackages`, even though `@fatexia/ui` exports raw TypeScript from
`src/index.ts` — Next compiles workspace-linked source directly. Verified by a local
`pnpm --filter public-site build`.

### Environment variables

| Project | Variable | Value |
|---|---|---|
| admin | `VITE_API_URL` | `https://fatexia-api.onrender.com` |
| affiliate | `VITE_API_URL` | `https://fatexia-api.onrender.com` |
| public | `NEXT_PUBLIC_API_URL` | same |
| public | `NEXT_PUBLIC_AFFILIATE_URL` | `https://affiliates.fatexia.com` |

**Vite bakes `VITE_API_URL` into the bundle at build time.** It is not read at runtime, so changing it requires a redeploy, not a restart. Setting it after the first deploy and wondering why the app still calls localhost is the classic version of this mistake.

### Why the SPA rewrites matter

`admin` and `affiliate` use React Router. The browser asks the server for `/reports/performance` before any JavaScript runs, and no such file exists on disk. Without the rewrite in `vercel.json`, every refresh and every pasted deep link 404s — while in-app navigation works fine, which makes it easy to miss until a user reports it.

---

## Order of operations

1. Push to GitHub (confirm no `.mmdb`, no `.env`).
2. Render Blueprint → wait for Postgres, Redis, both services.
3. Note the API and tracker URLs.
4. Deploy the three Vercel projects with `VITE_API_URL` / `NEXT_PUBLIC_*` set **before** the first build.
5. Note the Vercel URLs → set `CORS_ORIGIN` and `PUBLIC_TRACKING_URL` on both Render services → they redeploy.
6. `seed:prod` to create the first admin.
7. Point DNS at Render (`track.`) and Vercel (the rest).

Step 5 is circular by nature — the backend needs the frontend URLs and vice versa. Deploy the backend first with a placeholder `CORS_ORIGIN`, then correct it.

---

## Verifying a deploy

The dev scripts work against any host:

```bash
API_URL=https://fatexia-api.onrender.com node backend/scripts/dev/smoke-api.js
API_URL=https://fatexia-api.onrender.com node backend/scripts/dev/audit-affiliate-visibility.js
```

The second is worth running against production specifically: it asserts no affiliate-reachable endpoint exposes revenue or profit, and that admin-only endpoints reject an affiliate token.

---

## Known gaps at deploy time

- **Realtime is one instance only** — see above.
- **No `/postback` or `/sl` endpoint yet.** The tracker serves `/click` only. Smart-link URLs handed out by the admin panel will 404 until `/sl` is built, and conversions cannot arrive until `/postback` exists.
- **Clicks are written per-request**, not batched. Correct, but it is a database write on the redirect path — the ceiling is Postgres connections, so watch that before a large campaign.
- **No composite indexes** on `clicks`/`conversions` yet (`(offerId, createdAt)`, `(affiliateId, createdAt)`). Fine at current volume, will hurt reporting at scale.
