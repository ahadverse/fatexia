import { env } from '../../common/env';
import { AppError } from '../../common/errors';
import type { GeoipFetchResult, GeoipStatus } from '../../infra/geoip/ensure-geoip';

/**
 * Runs on the Admin API, which never holds GEOIP_DB_DIR/MAXMIND_LICENSE_KEY — those
 * belong to the Tracker service (see render.yaml). This proxies an already-admin-
 * authenticated request over to the Tracker's shared-secret-guarded
 * /internal/geoip/* routes, so the actual download always happens on the process that
 * will use the result.
 */
// A cold start on the free plan is tens of seconds; nothing here does real work while
// the caller waits, so anything past this is a service that is not coming back.
const TRACKER_TIMEOUT_MS = 90_000;

async function callTracker<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
  if (!env.GEOIP_ADMIN_SECRET) {
    throw new AppError('GEOIP_ADMIN_SECRET is not configured on the API service', 500);
  }

  let res: Response;
  try {
    res = await fetch(`${env.PUBLIC_TRACKING_URL}${path}`, {
      method,
      headers: { 'x-geoip-admin-secret': env.GEOIP_ADMIN_SECRET },
      // Both routes answer immediately now — the download runs in the background — so a
      // slow reply means the Tracker is waking from idle, not working. Generous enough
      // to cover a cold start, bounded so a hung service cannot hold an admin request
      // open indefinitely.
      signal: AbortSignal.timeout(TRACKER_TIMEOUT_MS),
    });
  } catch (err) {
    const message =
      err instanceof Error && err.name === 'TimeoutError'
        ? 'The Tracker service did not answer in time. On a free plan it can take up to a minute to wake — try again shortly.'
        : `Could not reach the Tracker service: ${(err as Error).message}`;
    throw new AppError(message, 502);
  }

  if (!res.ok) {
    throw new AppError(explainTrackerFailure(res.status, path), 502);
  }

  return (await res.json()) as T;
}

/**
 * Says which system actually refused, because the raw status is misleading here.
 *
 * A 429 on this route reads like MaxMind's download limit — the one thing this screen
 * is about — but it is far more often the platform in front of a Tracker that is asleep
 * or being woken too often. Reporting the number alone sent people off re-triggering
 * fetches, which is precisely what does eventually earn a real MaxMind 429.
 */
function explainTrackerFailure(status: number, path: string): string {
  if (status === 429) {
    return 'The Tracker service is refusing requests right now (HTTP 429). On a free plan this is usually the host throttling a service that is waking from idle, not MaxMind — wait a minute and try again.';
  }
  if (status === 502 || status === 503 || status === 504) {
    return `The Tracker service is not responding (HTTP ${status}). It may be starting up after being idle — wait a minute and try again.`;
  }
  if (status === 403) {
    return 'The Tracker rejected the admin secret. GEOIP_ADMIN_SECRET must be the identical value on both services.';
  }
  return `Tracker responded with HTTP ${status} for ${path}`;
}

export const geoipService = {
  getStatus(): Promise<GeoipStatus> {
    return callTracker<GeoipStatus>('/internal/geoip/status', 'GET');
  },

  fetchNow(): Promise<GeoipFetchResult> {
    return callTracker<GeoipFetchResult>('/internal/geoip/fetch', 'POST');
  },
};
