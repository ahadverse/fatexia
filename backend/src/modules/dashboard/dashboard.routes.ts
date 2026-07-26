import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { dashboardController } from './dashboard.controller';
import { reportFiltersSchema } from '../reports/report.dto';

export const dashboardRoutes = Router();

// Affiliate dashboard — a different shape from the admin one, with no revenue,
// profit or margin field anywhere on it.
dashboardRoutes.get(
  '/mine',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(reportFiltersSchema, 'query'),
  dashboardController.getOwnDashboard,
);

dashboardRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

dashboardRoutes.get('/', validate(reportFiltersSchema, 'query'), dashboardController.getDashboard);
