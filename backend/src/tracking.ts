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

  // No automatic GeoLite2 *download* here on purpose — see infra/geoip/ensure-geoip.ts.
  // MaxMind is only contacted when an admin triggers POST /internal/geoip/fetch
  // (proxied from the Admin panel).
  //
  // Restoring from our own database is a different thing entirely, and it is what makes
  // the above workable: this filesystem does not survive a restart, so without this the
  // files would be gone every time the service woke from idle and an admin would have to
  // fetch again — which is exactly what was running into MaxMind's rate limit. Costs one
  // query and no external call, and never throws; geo-source.ts still degrades to
  // "unknown" if there is nothing stored yet, so the click path is unaffected either way.
  await restoreGeoipFromStore();

  const app = createApp({ json: false, cors: false });

  mountTrackingRoutes(app);

  attachErrorHandler(app);

  app.listen(env.TRACKING_PORT, () => {
    logger.info(`Fatexia tracker listening on port ${env.TRACKING_PORT} (${env.NODE_ENV})`);
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start tracker');
  process.exit(1);
});
