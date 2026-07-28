import { Router, type NextFunction, type Request, type Response } from 'express';
import { env } from '../../common/env';
import { ForbiddenError } from '../../common/errors';
import { ensureGeoipDatabases, getGeoipStatus } from '../../infra/geoip/ensure-geoip';

/**
 * Lives only on the Tracker service — it's the one process that owns GEOIP_DB_DIR and
 * MAXMIND_LICENSE_KEY (see render.yaml). The Tracker never validates admin JWTs, so
 * this is guarded by a shared secret instead: the Admin API validates the logged-in
 * admin, then forwards the request here with that secret (see
 * backend/src/modules/geoip/geoip.controller.ts on the API side).
 */
function requireGeoipAdminSecret(req: Request, _res: Response, next: NextFunction): void {
  const provided = req.header('x-geoip-admin-secret');
  if (!env.GEOIP_ADMIN_SECRET || provided !== env.GEOIP_ADMIN_SECRET) {
    next(new ForbiddenError('Invalid or missing geoip admin secret'));
    return;
  }
  next();
}

export const geoipInternalRoutes = Router();

geoipInternalRoutes.use(requireGeoipAdminSecret);

geoipInternalRoutes.get('/status', (_req, res) => {
  res.json(getGeoipStatus());
});

geoipInternalRoutes.post('/fetch', async (_req, res, next) => {
  try {
    res.json(await ensureGeoipDatabases());
  } catch (err) {
    next(err);
  }
});
