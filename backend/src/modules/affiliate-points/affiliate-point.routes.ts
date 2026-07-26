import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { affiliatePointController } from './affiliate-point.controller';
import { adjustPointsSchema, pointFiltersSchema } from './affiliate-point.dto';

export const affiliatePointRoutes = Router();

// Affiliate self-service, ahead of the admin guard. Read-only: points are
// informational and not redeemable, so there is no affiliate-side write route.
affiliatePointRoutes.get(
  '/mine',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(pointFiltersSchema, 'query'),
  affiliatePointController.getOwnPoints,
);

affiliatePointRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

affiliatePointRoutes.get('/balances', affiliatePointController.getBalances);
affiliatePointRoutes.get('/', validate(pointFiltersSchema, 'query'), affiliatePointController.getEntries);
affiliatePointRoutes.post('/', validate(adjustPointsSchema), affiliatePointController.adjust);
