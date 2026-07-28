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
async function callTracker<T>(path: string, method: 'GET' | 'POST'): Promise<T> {
  if (!env.GEOIP_ADMIN_SECRET) {
    throw new AppError('GEOIP_ADMIN_SECRET is not configured on the API service', 500);
  }

  let res: Response;
  try {
    res = await fetch(`${env.PUBLIC_TRACKING_URL}${path}`, {
      method,
      headers: { 'x-geoip-admin-secret': env.GEOIP_ADMIN_SECRET },
    });
  } catch (err) {
    throw new AppError(`Could not reach the Tracker service: ${(err as Error).message}`, 502);
  }

  if (!res.ok) {
    throw new AppError(`Tracker responded with HTTP ${res.status} for ${path}`, 502);
  }

  return (await res.json()) as T;
}

export const geoipService = {
  getStatus(): Promise<GeoipStatus> {
    return callTracker<GeoipStatus>('/internal/geoip/status', 'GET');
  },

  fetchNow(): Promise<GeoipFetchResult> {
    return callTracker<GeoipFetchResult>('/internal/geoip/fetch', 'POST');
  },
};
