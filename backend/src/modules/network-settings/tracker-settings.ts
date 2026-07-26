import { logger } from '../../common/logger';
import { networkSettingRepository } from './network-setting.repository';

/**
 * The handful of network settings the click hot path needs, cached.
 *
 * The tracker previously hardcoded the fraud bands as module constants while the
 * Settings page offered inputs for them — so `fraudSuspectThreshold` and
 * `fraudBlockThreshold` were editable and read by nothing. Reading them here makes
 * that page do what it says.
 *
 * Cached rather than read per click for the obvious reason: this is the redirect path,
 * and a settings SELECT on every click is a database round-trip bought for a value
 * that changes a few times a year. The TTL is the tradeoff — an admin's change takes
 * effect within a minute rather than instantly, and `invalidateTrackerSettings()` on
 * save makes it instant within the saving process.
 */

const CACHE_TTL_MS = 60_000;

// Last-resort destination when neither the offer nor the network defines one. A
// plausible page, never a 403: an error response is a signature a bot operator can
// detect and route around, which turns a block into a hint about how to evade it.
export const DEFAULT_BLOCKED_REDIRECT_URL = 'https://www.google.com';

export interface TrackerSettings {
  suspectThreshold: number;
  blockThreshold: number;
  blockedRedirectUrl: string;
}

// Used when the settings row is unreachable. Matches the column defaults, so a
// database blip scores traffic exactly as a healthy read would.
const FALLBACK: TrackerSettings = {
  suspectThreshold: 30,
  blockThreshold: 70,
  blockedRedirectUrl: DEFAULT_BLOCKED_REDIRECT_URL,
};

let cached: { value: TrackerSettings; expiresAt: number } | null = null;

export async function getTrackerSettings(): Promise<TrackerSettings> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  try {
    const settings = await networkSettingRepository.find();
    const value: TrackerSettings = settings
      ? {
          suspectThreshold: settings.fraudSuspectThreshold,
          blockThreshold: settings.fraudBlockThreshold,
          blockedRedirectUrl: settings.blockedRedirectUrl?.trim() || DEFAULT_BLOCKED_REDIRECT_URL,
        }
      : FALLBACK;

    cached = { value, expiresAt: Date.now() + CACHE_TTL_MS };
    return value;
  } catch (err) {
    // Never block a redirect on a settings read. The failure is not cached, so the
    // next click retries rather than being stuck on defaults for a full TTL.
    logger.warn({ err }, 'Tracker settings lookup failed, using defaults');
    return FALLBACK;
  }
}

/** Called after an admin saves settings so the change lands immediately in-process. */
export function invalidateTrackerSettings(): void {
  cached = null;
}
