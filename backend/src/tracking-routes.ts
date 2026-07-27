import type { Express } from 'express';
import { clickRoutes } from './modules/clicks/click.routes';
import { postbackRoutes } from './modules/postback/postback.routes';

export function mountTrackingRoutes(app: Express): void {
  app.use('/click', clickRoutes);
  app.use('/postback', postbackRoutes);
}
