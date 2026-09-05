import type { Express } from 'express';
import { clickRoutes, smartLinkClickRoutes } from './modules/clicks/click.routes';
import { postbackRoutes } from './modules/postback/postback.routes';
import { geoipInternalRoutes } from './modules/geoip/geoip-internal.routes';

export function mountTrackingRoutes(app: Express): void {
  app.use('/click', clickRoutes);
  // The address smart-link.dto.ts builds into every smartLinkUrl it hands out.
  app.use('/sl', smartLinkClickRoutes);
  app.use('/postback', postbackRoutes);
  // Shared-secret guarded, not JWT — see geoip-internal.routes.ts.
  app.use('/internal/geoip', geoipInternalRoutes);
}
