import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope, requirePermission } from '../../common/guards/manager-scope.guard';
import { UserRole } from '../users/user.entity';
import { clickLogController } from './click-log.controller';
import { clickLogFiltersSchema } from './click.dto';

// Mounted on the main API (port 4000), unlike clickRoutes which belongs to the
// Tracker entrypoint — same table, opposite ends of its lifecycle.
export const clickLogRoutes = Router();

// Affiliate self-service, ahead of the admin guard. Returns a narrower row: the ASN,
// proxy flags and risk score are the network's own fraud reasoning.
// `/mine/countries` is registered before `/mine` so the literal path is matched first.
clickLogRoutes.get('/mine/countries', requireAuth, requireRole(UserRole.AFFILIATE), clickLogController.getOwnCountries);
clickLogRoutes.get(
  '/mine',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(clickLogFiltersSchema, 'query'),
  clickLogController.getOwnLogs,
);

clickLogRoutes.use(
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  attachManagerScope,
  requirePermission('reports.view'),
);

clickLogRoutes.get('/countries', clickLogController.getCountries);
clickLogRoutes.get('/', validate(clickLogFiltersSchema, 'query'), clickLogController.getLogs);
