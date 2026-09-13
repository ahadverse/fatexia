import { createApp, attachErrorHandler } from './app';
import { env } from './common/env';
import { logger } from './common/logger';
import { AppDataSource } from './infra/database/data-source';
import { restoreGeoipFromStore } from './infra/geoip/ensure-geoip';
import { mountTrackingRoutes } from './tracking-routes';

// Separate process from the main API (see PLAN-tracker.md) — click traffic load
// never touches the Admin/Affiliate panels. No JSON body parser (query-only
// endpoints) and no CORS (hit via 302 redirect / server-to-server, never fetched
// from a browser page).
async function bootstrap(): Promise<void> {
  await AppDataSource.initialize();

  const app = createApp({ json: false, cors: false });

  mountTrackingRoutes(app);

  attachErrorHandler(app);

  app.listen(env.TRACKING_PORT, () => {
    logger.info(`Fatexia tracker listening on port ${env.TRACKING_PORT} (${env.NODE_ENV})`);

    // No automatic GeoLite2 *download* here on purpose — see infra/geoip/ensure-geoip.ts.
    // MaxMind is only contacted when an admin triggers POST /internal/geoip/fetch.
    //
    // Restoring from our own database is a different thing, and it is what makes that
    // rule workable: this filesystem does not survive a restart, so without it the files
    // are gone after every wake from idle and an admin has to fetch again — which is
    // what was running into MaxMind's rate limit.
    //
    // Started after the server is listening, and deliberately not awaited. Held in front
    // of listen(), a slow or failing restore delays the health check and can take the
    // whole service down with it — and a Tracker that will not boot serves no clicks at
    // all, which is far worse than the missing geo data this exists to prevent. Clicks
    // in the first second or so resolve without geo, exactly as they do today when
    // nothing has been fetched yet.
    void restoreGeoipFromStore();
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start tracker');
  process.exit(1);
});
