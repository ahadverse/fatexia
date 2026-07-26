import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { postbackLogController } from './postback-log.controller';
import { postbackLogFiltersSchema } from './postback-log.dto';

// Read-only: rows are written by the Tracker's inbound handler and the outbound
// delivery worker, never by a portal action.
export const postbackLogRoutes = Router();

postbackLogRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

postbackLogRoutes.get('/', validate(postbackLogFiltersSchema, 'query'), postbackLogController.getLogs);
