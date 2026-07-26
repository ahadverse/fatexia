import { logger } from '../../common/logger';
import { integrationRepository } from './integration.repository';
import { IntegrationProvider, IntegrationStatus } from './integration.entity';

/**
 * Resolves a provider's credential for use at request time.
 *
 * The `integrations` table is the **only** source. There is deliberately no
 * environment-variable fallback: PLAN.md's rule is that every third-party credential
 * is entered through the Admin Integrations page and nowhere else, and a key that can
 * also live in `.env` breaks that in a way that is very hard to see. An operator
 * looking at the Integrations page would find IPHub blank, conclude it was off, and be
 * wrong — the process would be quietly billing an API against a key nobody could find.
 * The reverse is worse: a key entered in the UI that appears not to work because an
 * older env value is shadowing it.
 *
 * One source of truth means the page always tells the truth, and rotating a key is a
 * form submission rather than a redeploy.
 *
 * A DISABLED integration resolves to null even when it holds a key — "turned off" has
 * to actually turn the provider off, or the switch is decorative.
 */

// Short TTL, not a permanent memo: this sits on the click hot path, so it must not
// query Postgres per click — but a credential saved in the Admin UI also has to take
// effect without restarting the Tracker. 60s is the compromise, and it also bounds
// how long the API and Tracker processes can disagree after a change.
const CACHE_TTL_MS = 60_000;

interface CachedCredential {
  apiKey: string | null;
  expiresAt: number;
}

const cache = new Map<IntegrationProvider, CachedCredential>();

export async function getIntegrationApiKey(provider: IntegrationProvider): Promise<string | null> {
  const cached = cache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.apiKey;

  let apiKey: string | null;
  try {
    const record = await integrationRepository.findByProvider(provider);
    apiKey = record && record.status !== IntegrationStatus.DISABLED ? (record.apiKey?.trim() || null) : null;
  } catch (err) {
    // A database hiccup must not block a click. Skip the provider for this call and
    // do not cache the failure, so the next click retries the table rather than being
    // stuck without a credential for a full TTL.
    logger.warn({ err, provider }, 'Integration credential lookup failed, skipping provider');
    return null;
  }

  cache.set(provider, { apiKey, expiresAt: Date.now() + CACHE_TTL_MS });
  return apiKey;
}

/** Called after an admin saves an integration, so the change is visible immediately
 *  in this process rather than up to a TTL later. */
export function invalidateIntegrationCache(provider?: IntegrationProvider): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}
