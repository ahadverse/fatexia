import type { Express } from 'express';
import { clickRoutes } from './modules/clicks/click.routes';
import { postbackRoutes } from './modules/postback/postback.routes';
import { geoipInternalRoutes } from './modules/geoip/geoip-internal.routes';

export function mountTrackingRoutes(app: Express): void {
  app.use('/click', clickRoutes);
  app.use('/postback', postbackRoutes);
  // Shared-secret guarded, not JWT — see geoip-internal.routes.ts.
  app.use('/internal/geoip', geoipInternalRoutes);
}
