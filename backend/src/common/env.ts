import 'dotenv/config';

export type NodeEnv = 'development' | 'test' | 'production';

interface Env {
  PORT: number;
  TRACKING_PORT: number;
  NODE_ENV: NodeEnv;
  DATABASE_URL: string;
  // Whether to open the Postgres connection over TLS. Every hosted provider (Neon,
  // Supabase, RDS) requires it; a local dev Postgres does not offer it at all, so this
  // cannot simply be on always. Defaults to on in production, off elsewhere — but it is
  // deliberately overridable in development, because Neon is an external database and
  // running migrations against it from a laptop is a normal thing to do.
  DATABASE_SSL: boolean;
  // Backs the proxy-detection cache/quota counters (see fraud/proxy-detection.ts) and,
  // later, BullMQ queues. Local dev target is a WSL-hosted Redis reachable from Windows
  // at localhost — see PLAN-tracker.md Step 4/5.
  REDIS_URL: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_EXPIRES_IN: string;
  JWT_REFRESH_EXPIRES_IN: string;
  TRUST_PROXY: boolean | number | string;
  // Comma-separated list of browser origins allowed to call the REST API (the Admin +
  // Affiliate portal dev servers). Empty in dev means "reflect any origin" for local
  // convenience; in production it must be an explicit allowlist (enforced below).
  CORS_ORIGIN: string[];
  // Public base URL of the Tracker service — used only to compute the shareable offer
  // trackingLink DTO field, never for routing.
  PUBLIC_TRACKING_URL: string;
  // Public base URL of this API. Used for absolute links back to the app.
  PUBLIC_API_URL: string;
  // Public base URL of the affiliate portal — the {portal_link} an outbound email
  // (approval, offer-live) tells the recipient to click. Separate from PUBLIC_API_URL
  // because that is the REST API, which an affiliate has no reason to open in a
  // browser; sending them there is a dead end.
  AFFILIATE_PORTAL_URL: string;
  // Absolute URL of the wordmark shown in outbound email.
  //
  // Its own setting rather than derived from PUBLIC_API_URL, because the recipient's
  // mail client fetches this from their machine: pointed at a localhost API (the dev
  // default) every email ships a broken image, and even in production an image proxy
  // reaching a sleeping free-tier service is a slower, less reliable path than a
  // dedicated image host. A relative path or a data: URI will not render at all —
  // Gmail strips the latter outright.
  EMAIL_LOGO_URL: string;
  // Directory containing MaxMind GeoLite2 .mmdb files (GeoLite2-City.mmdb,
  // GeoLite2-ASN.mmdb). Requires a free MaxMind account + license key — see
  // backend/README or PLAN-tracker.md. Absent files degrade gracefully (geo/ASN
  // fields are just left unknown), never crash the click hot path.
  GEOIP_DB_DIR: string;
  // Used by the Tracker, on admin-triggered demand only (see
  // infra/geoip/ensure-geoip.ts and modules/geoip), to fetch the GeoLite2 databases.
  // Optional: missing means geo/ASN lookups just degrade to unknown, same as a
  // missing .mmdb file.
  MAXMIND_LICENSE_KEY: string | undefined;
  // Shared secret between the API and Tracker services, checked on the Tracker's
  // internal /internal/geoip/* routes (see modules/geoip/geoip-internal.routes.ts).
  // The Tracker never validates admin JWTs (see render.yaml) — the API validates the
  // logged-in admin, then forwards the request to the Tracker with this header
  // instead. Same value must be set on both services. Optional in dev; required in
  // production (enforced below) since it gates a network-wide config change.
  GEOIP_ADMIN_SECRET: string | undefined;
  // Deliberately absent: the residential-proxy provider keys (IPHub, ipapi.is, IPQS).
  // Those are runtime credentials and live only in the `integrations` table, entered
  // through the Admin Integrations page — see integration-credentials.ts. Declaring
  // them here too would give an operator two places to look and one of them would
  // eventually be wrong.
}

// Shipped dev defaults — public in the repo, safe only for local development.
const DEV_ACCESS_SECRET = 'dev-access-secret-change-me';
const DEV_REFRESH_SECRET = 'dev-refresh-secret-change-me';

function readNodeEnv(): NodeEnv {
  const value = process.env.NODE_ENV;
  if (value === 'development' || value === 'test' || value === 'production') {
    return value;
  }
  return 'development';
}

function readInt(name: string, fallback: number): number {
  const value = process.env[name];
  const parsed = value ? Number.parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed)) {
    return fallback;
  }
  return parsed;
}

function readRequired(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

function readBool(name: string, fallback: boolean): boolean {
  const value = process.env[name]?.trim();
  if (!value) {
    return fallback;
  }
  return value === 'true' || value === '1';
}

// Parse a comma-separated origin allowlist (e.g. "http://localhost:5173,https://app.example.com").
// Blank/unset → empty list, which the CORS middleware treats as "reflect any origin" (dev only).
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }
  return raw
    .split(',')
    .map((o) => o.trim())
    .filter((o) => o.length > 0);
}

// Express `trust proxy` accepts a boolean, a hop count, or a subnet/preset string. Behind
// a load balancer / reverse proxy this must be set so `req.ip` is the real client IP.
// Default off in dev.
export function parseTrustProxy(raw: string | undefined): boolean | number | string {
  if (raw === undefined || raw.trim() === '') {
    return false;
  }
  const value = raw.trim();
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }
  return value;
}

// Tracking links are built by concatenation (`${base}/click?...`), so a base URL
// pasted from a browser bar — which includes the trailing slash — would produce
// `https://track.example.com//click`. Some CDNs and proxies treat that as a distinct
// path and 404 it, and the affiliate who copied the link is the one who finds out.
export function stripTrailingSlash(url: string): string {
  return url.replace(/\/+$/, '');
}

export const env: Env = {
  PORT: readInt('PORT', 4000),
  // Falls back to PORT so the Tracker binds whatever its host assigns it.
  //
  // Locally both are set (4000 / 4001) and the two processes run side by side, so
  // TRACKING_PORT wins and nothing collides. On a platform that runs each process as
  // its own service — Render, Fly, Heroku — only PORT is injected, and a Tracker
  // hardcoded to 4001 would start cleanly but bind a port nothing routes to, which
  // surfaces as a failing health check rather than an obvious error.
  TRACKING_PORT: readInt('TRACKING_PORT', readInt('PORT', 4001)),
  NODE_ENV: readNodeEnv(),
  DATABASE_URL: readRequired('DATABASE_URL', 'postgres://postgres:postgres@localhost:5432/fatexia'),
  DATABASE_SSL: readBool('DATABASE_SSL', readNodeEnv() === 'production'),
  REDIS_URL: readRequired('REDIS_URL', 'redis://localhost:6379'),
  JWT_ACCESS_SECRET: readRequired('JWT_ACCESS_SECRET', DEV_ACCESS_SECRET),
  JWT_REFRESH_SECRET: readRequired('JWT_REFRESH_SECRET', DEV_REFRESH_SECRET),
  JWT_ACCESS_EXPIRES_IN: readRequired('JWT_ACCESS_EXPIRES_IN', '15m'),
  JWT_REFRESH_EXPIRES_IN: readRequired('JWT_REFRESH_EXPIRES_IN', '7d'),
  TRUST_PROXY: parseTrustProxy(process.env.TRUST_PROXY),
  CORS_ORIGIN: parseCorsOrigins(process.env.CORS_ORIGIN),
  PUBLIC_TRACKING_URL: stripTrailingSlash(readRequired('PUBLIC_TRACKING_URL', 'http://localhost:4001')),
  PUBLIC_API_URL: stripTrailingSlash(readRequired('PUBLIC_API_URL', 'http://localhost:4000')),
  AFFILIATE_PORTAL_URL: stripTrailingSlash(readRequired('AFFILIATE_PORTAL_URL', 'http://localhost:5174')),
  EMAIL_LOGO_URL: readRequired('EMAIL_LOGO_URL', 'https://i.ibb.co.com/gbhCjYwD/logo.png'),
  GEOIP_DB_DIR: readRequired('GEOIP_DB_DIR', 'data/geoip'),
  MAXMIND_LICENSE_KEY: process.env.MAXMIND_LICENSE_KEY || undefined,
  GEOIP_ADMIN_SECRET: process.env.GEOIP_ADMIN_SECRET || undefined,
};

// In production the JWT secrets must be real, unique values — never the shipped dev
// defaults (public in the repo) and never empty, or anyone could forge tokens. Fail
// fast at boot instead of silently running insecure.
export function assertSecureProductionSecrets(
  e: Pick<Env, 'NODE_ENV' | 'JWT_ACCESS_SECRET' | 'JWT_REFRESH_SECRET'>,
): void {
  if (e.NODE_ENV !== 'production') {
    return;
  }
  const weak: string[] = [];
  if (!e.JWT_ACCESS_SECRET || e.JWT_ACCESS_SECRET === DEV_ACCESS_SECRET) {
    weak.push('JWT_ACCESS_SECRET');
  }
  if (!e.JWT_REFRESH_SECRET || e.JWT_REFRESH_SECRET === DEV_REFRESH_SECRET) {
    weak.push('JWT_REFRESH_SECRET');
  }
  if (weak.length > 0) {
    throw new Error(
      `Refusing to start in production with missing or default secret(s): ${weak.join(', ')}. Set strong, unique values.`,
    );
  }
}

// In production the CORS allowlist must be explicit — an empty list means "reflect any
// origin", which is fine for local dev but unsafe for a public deployment. Fail fast so
// it's never shipped wide open.
export function assertProductionCorsAllowlist(e: Pick<Env, 'NODE_ENV' | 'CORS_ORIGIN'>): void {
  if (e.NODE_ENV === 'production' && e.CORS_ORIGIN.length === 0) {
    throw new Error(
      'Refusing to start in production with an empty CORS_ORIGIN. Set an explicit comma-separated allowlist of the frontend origins.',
    );
  }
}

assertSecureProductionSecrets(env);
assertProductionCorsAllowlist(env);
