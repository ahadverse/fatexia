import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { managerController } from './manager.controller';
import {
  createManagerSchema,
  managerFiltersSchema,
  updateManagerSchema,
  updateManagerStatusSchema,
} from './manager.dto';

export const managerRoutes = Router();

// A manager's own profile — how the portal learns which capabilities to render
// (issue #20). Registered ahead of `/:id`, which would otherwise match `/me`.
managerRoutes.get('/me', requireAuth, requireRole(UserRole.MANAGER), managerController.getOwnManager);

// Managers are readable by MANAGER-role staff (an affiliate form needs the assignable
// list), but creating/editing staff accounts is ADMIN-only per PLAN-backend.md's
// permission matrix.
managerRoutes.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  validate(managerFiltersSchema, 'query'),
  managerController.getManagers,
);

managerRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

managerRoutes.get('/:id', managerController.getManager);
managerRoutes.post('/', validate(createManagerSchema), managerController.createManager);
managerRoutes.patch('/:id', validate(updateManagerSchema), managerController.updateManager);
managerRoutes.patch('/:id/status', validate(updateManagerStatusSchema), managerController.updateStatus);
