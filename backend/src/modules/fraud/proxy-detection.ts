import { logger } from '../../common/logger';
import { redis } from '../../infra/redis/redis-client';
import { IntegrationProvider } from '../integrations/integration.entity';
import { getIntegrationCredentials } from '../integrations/integration-credentials';
import { isPrivateOrLoopback, normalizeIp } from '../geo-source/geo-source';

// Cascading free-tier residential-proxy detection (PLAN-tracker.md Step 5): IPHub →
// ipapi.is → IPQS, falling through to the next when one is exhausted or unconfigured.
// Returns null (never scored) rather than throwing, so a provider outage or quota
// exhaustion never blocks a click — that's the fail-open rule.
//
// Each provider may hold several credentials, tried in order before the cascade moves
// on. The free tiers are metered per key, so adding a second IPHub key doubles the
// daily allowance; quota is therefore counted per credential, never per provider.
//
// Keys come from `getIntegrationCredentials`, which reads the Admin Integrations page
// and nothing else. There is no env fallback: a key that can also live in `.env` makes
// the page lie about what is configured, in both directions.
//
// Cache (24h TTL) and per-credential quota counters live in Redis (see
// infra/redis/redis-client.ts) so they survive restarts and are shared across
// multiple Tracker processes, per PLAN-tracker.md Step 4/5. A Redis error is treated
// the same as "quota unavailable" — the credential is skipped, never called unmetered.
const CACHE_TTL_SECONDS = 24 * 60 * 60;
const CACHE_KEY_PREFIX = 'proxy-detect:cache:';
const QUOTA_KEY_PREFIX = 'proxy-detect:quota:';

const DAILY_LIMIT = 1000;
const MONTHLY_LIMIT = 1000;

function secondsUntil(targetMs: number): number {
  return Math.max(1, Math.ceil((targetMs - Date.now()) / 1000));
}

function startOfNextDay(): number {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
}

function startOfNextMonth(): number {
  const d = new Date();
  d.setMonth(d.getMonth() + 1, 1);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Atomic INCR + EXPIRE-on-first-increment. The key itself expires at the reset
// boundary, so there's no separate reset bookkeeping to get out of sync.
//
// Counted per credential id, not per provider: the allowance being spent belongs to
// one API key, and several keys sharing a counter would make the second one useless.
async function takeQuota(credentialId: string, limit: number, resetAtMs: number): Promise<boolean> {
  try {
    const key = `${QUOTA_KEY_PREFIX}${credentialId}`;
    const count = await redis.incr(key);
    if (count === 1) {
      await redis.expire(key, secondsUntil(resetAtMs));
    }
    return count <= limit;
  } catch (err) {
    logger.warn({ err, credentialId }, 'Redis quota check failed, skipping credential');
    return false;
  }
}

/**
 * One provider probe, without the quota/caching wrapper.
 *
 * Split out so the Integrations "Test connection" action can exercise exactly the
 * same request the click path makes — a test that hits a different code path proves
 * nothing about the thing it claims to be testing. It throws on failure so the test
 * action can surface *why*; the click path swallows that into null.
 */
export async function probeProvider(
  provider: IntegrationProvider,
  apiKey: string,
  ip: string,
): Promise<boolean> {
  if (provider === IntegrationProvider.IPHUB) {
    const res = await fetch(`https://v2.api.iphub.info/ip/${ip}`, { headers: { 'X-Key': apiKey } });
    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? 'IPHub rejected the request: rate limit or daily quota exhausted'
          : `IPHub returned HTTP ${res.status}${res.status === 403 ? ' — the API key was not accepted' : ''}`,
      );
    }
    const data = (await res.json()) as { block?: number };
    // IPHub's `block`: 0 = residential/safe, 1 = confirmed proxy/hosting, 2 = non-residential.
    return data.block === 1;
  }

  if (provider === IntegrationProvider.IPAPI_IS) {
    const res = await fetch(`https://api.ipapi.is/?q=${ip}&key=${apiKey}`);
    if (!res.ok) throw new Error(`ipapi.is returned HTTP ${res.status}`);
    const data = (await res.json()) as { is_proxy?: boolean; is_vpn?: boolean; is_datacenter?: boolean };
    return Boolean(data.is_proxy || data.is_vpn || data.is_datacenter);
  }

  if (provider === IntegrationProvider.IPQS) {
    const res = await fetch(`https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}`);
    if (!res.ok) throw new Error(`IPQS returned HTTP ${res.status}`);
    // IPQS answers 200 with success:false for a bad key, so the body has to be read.
    const data = (await res.json()) as { success?: boolean; message?: string; proxy?: boolean; vpn?: boolean };
    if (data.success === false) throw new Error(data.message ?? 'IPQS rejected the request');
    return Boolean(data.proxy || data.vpn);
  }

  throw new Error(`${provider} is not a proxy-detection provider`);
}

/**
 * Tries every credential a provider holds, in order, and returns the first answer.
 *
 * A provider can be configured several times over — the free tiers are metered per
 * key, so three IPHub keys are three thousand lookups a day rather than one thousand.
 * Each is spent in turn: exhausted, unconfigured or failing, the next one is tried,
 * and only when all of them are used up does the cascade move to the next provider.
 *
 * Quota is counted against the credential's own id, not the provider's name. Keyed by
 * name, a second key would share the first one's allowance and buy nothing.
 *
 * A failure is a skip, never a throw. This sits on the click path, where the fail-open
 * rule says an unavailable provider must cost a signal, not a redirect.
 */
async function checkProvider(
  provider: IntegrationProvider,
  ip: string,
  limit: number,
  resetAtMs: number,
): Promise<boolean | null> {
  const credentials = await getIntegrationCredentials(provider);

  for (const credential of credentials) {
    if (!(await takeQuota(credential.id, limit, resetAtMs))) continue;

    try {
      return await probeProvider(provider, credential.apiKey, ip);
    } catch (err) {
      logger.warn({ err, provider, credentialId: credential.id }, 'Proxy check failed, trying the next credential');
    }
  }

  return null;
}

// null = never resolved (all providers unconfigured/exhausted/failed) — the caller
// treats this as UNSCORED, not "clean".
export async function checkResidentialProxy(ip: string): Promise<boolean | null> {
  const normalized = normalizeIp(ip);
  // A private/loopback address is never a residential proxy — it's the Tracker's own
  // network (or a misconfigured TRUST_PROXY handing back an internal hop instead of the
  // real client). Providers have no way to classify it either way, so this must be
  // checked before spending quota, not left to fail through and burn a real API call on
  // an address that can never resolve to a useful answer — that's what was happening.
  if (!normalized || isPrivateOrLoopback(normalized)) {
    return null;
  }

  try {
    const cached = await redis.get(`${CACHE_KEY_PREFIX}${normalized}`);
    if (cached !== null) {
      return cached === '1';
    }
  } catch (err) {
    logger.warn({ err }, 'Redis cache read failed, falling through to providers');
  }

  // Each provider exhausts all of its own keys before the next provider is reached —
  // a second IPHub key is preferred over ipapi.is, because it is the same signal from
  // the provider the operator ordered first.
  const result =
    (await checkProvider(IntegrationProvider.IPHUB, normalized, DAILY_LIMIT, startOfNextDay())) ??
    (await checkProvider(IntegrationProvider.IPAPI_IS, normalized, DAILY_LIMIT, startOfNextDay())) ??
    (await checkProvider(IntegrationProvider.IPQS, normalized, MONTHLY_LIMIT, startOfNextMonth()));

  if (result === null) {
    return null;
  }

  try {
    await redis.set(`${CACHE_KEY_PREFIX}${normalized}`, result ? '1' : '0', 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, 'Redis cache write failed');
  }
  return result;
}
