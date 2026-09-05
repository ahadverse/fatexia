import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope } from '../../common/guards/manager-scope.guard';
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

// No permission gate: the dashboard is every staff account's landing page, and the
// scope in the controller already narrows a manager's figures to their own affiliates.
dashboardRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), attachManagerScope);

dashboardRoutes.get('/', validate(reportFiltersSchema, 'query'), dashboardController.getDashboard);
