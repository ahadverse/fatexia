import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope, requirePermission } from '../../common/guards/manager-scope.guard';
import { UserRole } from '../users/user.entity';
import { postbackLogController } from './postback-log.controller';
import { bulkDeletePostbackLogsSchema, postbackLogFiltersSchema } from './postback-log.dto';

// Rows are written by the Tracker's inbound handler and the outbound delivery
// worker, never by a portal action — reading and deleting are the only actions a
// portal user takes here.
export const postbackLogRoutes = Router();

postbackLogRoutes.use(
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  attachManagerScope,
  requirePermission('reports.view'),
);

postbackLogRoutes.get('/', validate(postbackLogFiltersSchema, 'query'), postbackLogController.getLogs);

// Admin-only, stricter than the ADMIN/MANAGER read above — there is no manager
// permission for deleting audit/log data (same posture as invoices' hard-delete).
postbackLogRoutes.post(
  '/bulk-delete',
  requireRole(UserRole.ADMIN),
  validate(bulkDeletePostbackLogsSchema),
  postbackLogController.bulkDelete,
);
