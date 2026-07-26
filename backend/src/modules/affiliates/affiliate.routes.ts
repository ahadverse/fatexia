import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { affiliateController } from './affiliate.controller';
import {
  affiliateFiltersSchema,
  createAffiliateSchema,
  updateAffiliateSchema,
  updateAffiliateStatusSchema,
  updateOwnProfileSchema,
} from './affiliate.dto';

export const affiliateRoutes = Router();

// Affiliate self-service — registered before the admin guard, and ahead of `/:id`
// which would otherwise match `/me`. The service resolves the profile from the JWT,
// never from a client-supplied id.
affiliateRoutes.get('/me', requireAuth, requireRole(UserRole.AFFILIATE), affiliateController.getOwnProfile);
affiliateRoutes.get('/me/referrals', requireAuth, requireRole(UserRole.AFFILIATE), affiliateController.getOwnReferrals);
affiliateRoutes.patch(
  '/me',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(updateOwnProfileSchema),
  affiliateController.updateOwnProfile,
);

affiliateRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

affiliateRoutes.get('/', validate(affiliateFiltersSchema, 'query'), affiliateController.getAffiliates);
affiliateRoutes.get('/:id', affiliateController.getAffiliate);
affiliateRoutes.post('/', validate(createAffiliateSchema), affiliateController.createAffiliate);
affiliateRoutes.patch('/:id', validate(updateAffiliateSchema), affiliateController.updateAffiliate);
affiliateRoutes.patch('/:id/status', validate(updateAffiliateStatusSchema), affiliateController.updateStatus);
