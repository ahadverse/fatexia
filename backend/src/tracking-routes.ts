import type { Express } from 'express';
import { clickRoutes } from './modules/clicks/click.routes';

export function mountTrackingRoutes(app: Express): void {
  app.use('/click', clickRoutes);
}
