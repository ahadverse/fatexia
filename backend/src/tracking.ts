import { createApp, attachErrorHandler } from './app';
import { env } from './common/env';
import { logger } from './common/logger';
import { AppDataSource } from './infra/database/data-source';
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
  });
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Failed to start tracker');
  process.exit(1);
});
