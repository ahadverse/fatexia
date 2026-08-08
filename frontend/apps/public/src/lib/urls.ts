/**
 * Absolute URL of the Affiliate portal, which is a separate deployment.
 *
 * The fallback is environment-aware on purpose. A plain
 * `process.env.NEXT_PUBLIC_AFFILIATE_URL ?? 'http://localhost:5174'` shipped a
 * production build that sent real visitors clicking "Sign in" to their own machine,
 * because the variable simply wasn't set on the host — and `NEXT_PUBLIC_*` values are
 * baked in at build time, so nothing at runtime could correct it. A localhost address
 * must never be reachable from a production page: it fails in a way that looks like
 * the site is broken, and it fails silently at build time.
 *
 * Setting NEXT_PUBLIC_AFFILIATE_URL is still the right thing to do (it is what makes
 * preview deployments point at the right portal); this just makes forgetting it
 * degrade to the real domain instead of to nothing.
 */
const PRODUCTION_AFFILIATE_URL = 'https://affiliates.fatexia.com';
const DEV_AFFILIATE_URL = 'http://localhost:5174';

export const AFFILIATE_URL =
  process.env.NEXT_PUBLIC_AFFILIATE_URL ??
  (process.env.NODE_ENV === 'production' ? PRODUCTION_AFFILIATE_URL : DEV_AFFILIATE_URL);

export const AFFILIATE_LOGIN_URL = `${AFFILIATE_URL}/login`;
export const AFFILIATE_REGISTER_URL = `${AFFILIATE_URL}/register`;
