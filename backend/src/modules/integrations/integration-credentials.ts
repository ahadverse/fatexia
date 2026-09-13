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

/** One usable credential: the key, and the row id its quota is counted against. */
export interface ProviderCredential {
  id: string;
  apiKey: string;
}

interface CachedCredentials {
  credentials: ProviderCredential[];
  expiresAt: number;
}

const cache = new Map<IntegrationProvider, CachedCredentials>();

/**
 * Every usable credential for a provider, in cascade order.
 *
 * A provider can hold several — the free tiers are metered per key, so a second IPHub
 * key is a second daily allowance. Rows with no key, or switched off, are dropped here
 * rather than in the caller, so "skip this one and try the next" is one rule in one
 * place.
 *
 * The id comes back with the key because quota is counted per credential. Counting per
 * provider would make three keys share one allowance, which is the opposite of why a
 * second key was added.
 */
export async function getIntegrationCredentials(provider: IntegrationProvider): Promise<ProviderCredential[]> {
  const cached = cache.get(provider);
  if (cached && cached.expiresAt > Date.now()) return cached.credentials;

  let credentials: ProviderCredential[];
  try {
    const records = await integrationRepository.findAllByProvider(provider);
    credentials = records
      .filter((record) => record.status !== IntegrationStatus.DISABLED)
      .flatMap((record) => {
        const apiKey = record.apiKey?.trim();
        return apiKey ? [{ id: record.id, apiKey }] : [];
      });
  } catch (err) {
    // A database hiccup must not block a click. Skip the provider for this call and
    // do not cache the failure, so the next click retries the table rather than being
    // stuck without a credential for a full TTL.
    logger.warn({ err, provider }, 'Integration credential lookup failed, skipping provider');
    return [];
  }

  cache.set(provider, { credentials, expiresAt: Date.now() + CACHE_TTL_MS });
  return credentials;
}

/** The first usable credential — for providers that only ever have one, like SMTP. */
export async function getIntegrationApiKey(provider: IntegrationProvider): Promise<string | null> {
  const [first] = await getIntegrationCredentials(provider);
  return first?.apiKey ?? null;
}

/** Called after an admin saves an integration, so the change is visible immediately
 *  in this process rather than up to a TTL later. */
export function invalidateIntegrationCache(provider?: IntegrationProvider): void {
  if (provider) cache.delete(provider);
  else cache.clear();
}
