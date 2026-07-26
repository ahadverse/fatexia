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

The root `.gitignore` now excludes them. They are downloaded during each build by `backend/scripts/fetch-geoip.js` using `MAXMIND_LICENSE_KEY`. Verify before pushing:

```bash
git status --porcelain | grep -i mmdb   # must print nothing
```

If the key is absent the build still succeeds — geo/ASN lookups return unknown, which disables the datacenter fraud filter but breaks nothing else.

### 2. Remove the credentials file from the working tree

`credentails.md` is gitignored now, but confirm it was never staged.

---

## Backend — Render

`render.yaml` at the repo root is a Blueprint describing both services, Postgres and Redis. In the Render dashboard: **New → Blueprint → select this repo**.

Then set the four values marked `sync: false` (Render will not invent them):

| Variable | Set on | Value |
|---|---|---|
| `CORS_ORIGIN` | both | `https://admin.fatexia.com,https://affiliates.fatexia.com,https://fatexia.com` |
| `PUBLIC_TRACKING_URL` | **API only** | `https://track.fatexia.com` |
| `MAXMIND_LICENSE_KEY` | both | from your MaxMind account |

**The proxy-provider keys are not environment variables.** IPHub, ipapi.is and IPQS
are entered in the Admin portal under **Integrations** after the first deploy, and read
from the `integrations` table at request time. There is deliberately no env fallback —
two homes for one credential means one is eventually stale, and it fails silently in
both directions: a key only in env makes the Integrations page look unconfigured while
the provider is being billed, and a key only in the UI appears broken if a stale env
value shadows it. Rotating a key is a form submission, not a redeploy.

`MAXMIND_LICENSE_KEY` stays an env var because it is a *build* input — the script that
downloads the `.mmdb` files uses it; no running process ever reads it.

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

### Creating the first admin

Once deployed, from the Render shell on `fatexia-api`:

```bash
ADMIN_EMAIL=you@yourdomain.com ADMIN_PASSWORD='<strong>' npm run seed:prod
```

`seed:prod` creates only the first admin and never overwrites an existing one. **Do not run `npm run seed`** — the dev seed refuses to run with `NODE_ENV=production`, but it is worth knowing why: it would insert 2,400 fake clicks and demo affiliates into your live database.

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

For the Next.js project, set the install command in project settings to `cd ../.. && pnpm install --frozen-lockfile` and the build command to `cd ../.. && pnpm --filter public-site build`.

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
