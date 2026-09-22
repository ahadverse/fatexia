import type { Express } from 'express';
import { clickRoutes, smartLinkClickRoutes } from './modules/clicks/click.routes';
import { postbackRoutes } from './modules/postback/postback.routes';
import { geoipInternalRoutes } from './modules/geoip/geoip-internal.routes';
import { visitorErrorPage } from './common/visitor-error-page';

export function mountTrackingRoutes(app: Express): void {
  // `visitorErrorPage` is mounted in the same chain as each router, so it only catches
  // what that router passes to next(err) — everything else still falls through to the
  // shared JSON handler that tracking.ts attaches last. These two routes are the ones a
  // person lands on in a browser; the two below are machine-to-machine and keep JSON.
  app.use('/click', clickRoutes, visitorErrorPage);
  // The address smart-link.dto.ts builds into every smartLinkUrl it hands out.
  app.use('/sl', smartLinkClickRoutes, visitorErrorPage);
  app.use('/postback', postbackRoutes);
  // Shared-secret guarded, not JWT — see geoip-internal.routes.ts.
  app.use('/internal/geoip', geoipInternalRoutes);
}
