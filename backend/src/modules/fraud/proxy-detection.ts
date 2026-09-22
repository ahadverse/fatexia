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
// `v2` because the cached value changed shape: it held '1'/'0' when the cascade answered
// with a boolean, and now holds a serialized ProxyVerdict. Bumping the prefix retires the
// old entries on their own TTL instead of forcing every read to guess which shape it got
// — the cost is at most one day of re-lookups, paid once at deploy.
const CACHE_KEY_PREFIX = 'proxy-detect:cache:v2:';
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
 * What one provider lookup actually told us.
 *
 * This used to be a bare `boolean`. Every one of these providers answers with a whole
 * record — IPHub returns seven fields — and all but the verdict were being parsed and
 * dropped, on a call whose whole cost is the quota it spends. The extra fields are free
 * in every sense that matters: the request was already made and paid for.
 *
 * They are kept as *the provider's own* answer, never merged into the MaxMind columns
 * next to them. `asnNumber` here and `asnNumber` on the click are two independent
 * sources, and the whole value of holding both is that they can disagree.
 */
export interface ProxyVerdict {
  /** Which provider in the cascade actually answered — the later ones are fallbacks. */
  provider: IntegrationProvider;
  /**
   * Flagged as proxy/VPN/hosting. Identical in meaning to the boolean this type
   * replaced, so the existing risk weighting keeps scoring exactly what it scored.
   */
  flagged: boolean;
  /**
   * IPHub's `block` verbatim: 0 = residential/safe, 1 = confirmed proxy/hosting,
   * 2 = non-residential. null for the other two providers, which have no equivalent.
   *
   * Stored raw rather than folded into `flagged` because 2 is genuinely a third state:
   * IPHub is saying "this is not a home connection" without claiming it is a proxy.
   * Collapsing it into the boolean is what made `block: 2` read as confidently clean.
   */
  block: number | null;
  /** rDNS. The one field here that is a fact rather than an inference — and MaxMind has no equivalent. */
  hostname: string | null;
  isp: string | null;
  asnNumber: number | null;
  countryCode: string | null;
}

/**
 * Is this parsed cache entry actually a verdict?
 *
 * `JSON.parse` is not a validator, and the two values that matter most here get through
 * it without complaint: the old cache held `'1'` and `'0'`, which parse cleanly to
 * numbers. A bare `as ProxyVerdict` on that result puts a number on the click path,
 * where `flagged` reads `undefined` and all six columns are written empty — for the
 * full 24h TTL, for every click from that address, with nothing logged.
 *
 * The `v2` key prefix means a genuine legacy entry is no longer read at all, so this
 * guards the general case rather than that one: a truncated write, a hand-edited key, or
 * the next time this shape changes. Checked on the two fields the caller cannot do
 * without — the rest are nullable by design and a missing one costs only itself.
 */
function isProxyVerdict(value: unknown): value is ProxyVerdict {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProxyVerdict>;
  return typeof candidate.flagged === 'boolean' && typeof candidate.provider === 'string';
}

function str(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function int(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.trunc(value);
  // IPQS and ipapi.is have both been seen answering with the number as a string, and an
  // ASN that arrives as "7922" is not a reason to record nothing.
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value.replace(/^AS/i, ''), 10);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * One provider probe, without the quota/caching wrapper.
 *
 * Split out so the Integrations "Test connection" action can exercise exactly the
 * same request the click path makes — a test that hits a different code path proves
 * nothing about the thing it claims to be testing. It throws on failure so the test
 * action can surface *why*; the click path swallows that into null.
 *
 * Every field but the verdict is parsed defensively: a provider that renames or drops
 * one must cost that single column, never the classification the click path is waiting
 * on. That is why nothing below is destructured or asserted.
 */
export async function probeProvider(
  provider: IntegrationProvider,
  apiKey: string,
  ip: string,
): Promise<ProxyVerdict> {
  if (provider === IntegrationProvider.IPHUB) {
    const res = await fetch(`https://v2.api.iphub.info/ip/${ip}`, { headers: { 'X-Key': apiKey } });
    if (!res.ok) {
      throw new Error(
        res.status === 429
          ? 'IPHub rejected the request: rate limit or daily quota exhausted'
          : `IPHub returned HTTP ${res.status}${res.status === 403 ? ' — the API key was not accepted' : ''}`,
      );
    }
    const data = (await res.json()) as Record<string, unknown>;
    const block = int(data.block);
    return {
      provider,
      // Still `block === 1` only. Whether 2 should cost anything is a scoring question,
      // decided in scoreClick against the stored value — not silently here.
      flagged: block === 1,
      block,
      hostname: str(data.hostname),
      isp: str(data.isp),
      asnNumber: int(data.asn),
      countryCode: str(data.countryCode),
    };
  }

  if (provider === IntegrationProvider.IPAPI_IS) {
    const res = await fetch(`https://api.ipapi.is/?q=${ip}&key=${apiKey}`);
    if (!res.ok) throw new Error(`ipapi.is returned HTTP ${res.status}`);
    const data = (await res.json()) as Record<string, unknown>;
    // ipapi.is nests the network detail; `rir_allocation`/`location` may be absent
    // entirely for an unallocated address.
    const asn = (data.asn ?? {}) as Record<string, unknown>;
    const company = (data.company ?? {}) as Record<string, unknown>;
    const location = (data.location ?? {}) as Record<string, unknown>;
    return {
      provider,
      flagged: Boolean(data.is_proxy || data.is_vpn || data.is_datacenter),
      block: null,
      hostname: str(data.rdns),
      isp: str(asn.org) ?? str(company.name),
      asnNumber: int(asn.asn),
      countryCode: str(location.country_code),
    };
  }

  if (provider === IntegrationProvider.IPQS) {
    const res = await fetch(`https://ipqualityscore.com/api/json/ip/${apiKey}/${ip}`);
    if (!res.ok) throw new Error(`IPQS returned HTTP ${res.status}`);
    // IPQS answers 200 with success:false for a bad key, so the body has to be read.
    const data = (await res.json()) as Record<string, unknown>;
    if (data.success === false) throw new Error(str(data.message) ?? 'IPQS rejected the request');
    return {
      provider,
      flagged: Boolean(data.proxy || data.vpn),
      block: null,
      hostname: str(data.host),
      isp: str(data.ISP) ?? str(data.organization),
      asnNumber: int(data.ASN),
      countryCode: str(data.country_code),
    };
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
): Promise<ProxyVerdict | null> {
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
export async function checkResidentialProxy(ip: string): Promise<ProxyVerdict | null> {
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
      // A cached entry is the whole verdict now, so a cache hit and a live lookup put
      // the same columns on the click — otherwise the second click from an address
      // would silently lose the hostname the first one recorded.
      const parsed = JSON.parse(cached) as unknown;
      if (isProxyVerdict(parsed)) {
        return parsed;
      }
      // Parsed, but not a verdict. Falling through costs one metered lookup and the
      // write below replaces the bad entry; returning it would cost every click from
      // this address until the TTL expired.
      logger.warn({ ip: normalized }, 'Discarding malformed proxy-detection cache entry');
    }
  } catch (err) {
    // A JSON parse failure lands here; a well-formed value of the wrong shape does not,
    // which is what isProxyVerdict is for. Either way the click must not be taken down.
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
    await redis.set(`${CACHE_KEY_PREFIX}${normalized}`, JSON.stringify(result), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn({ err }, 'Redis cache write failed');
  }
  return result;
}
