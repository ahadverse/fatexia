import { Router, type NextFunction, type Response } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope, requirePermission, type ScopedRequest } from '../../common/guards/manager-scope.guard';
import type { ManagerPermission } from '../managers/manager.entity';
import { UserRole, UserStatus } from '../users/user.entity';
import { affiliateController } from './affiliate.controller';
import {
  affiliateFiltersSchema,
  createAffiliateSchema,
  updateAffiliateSchema,
  updateAffiliateStatusSchema,
  updateOwnProfileSchema,
  type UpdateAffiliateStatusDto,
} from './affiliate.dto';

export const affiliateRoutes = Router();

// Affiliate self-service — registered before the admin guard, and ahead of `/:id`
// which would otherwise match `/me`. The service resolves the profile from the JWT,
// never from a client-supplied id.
affiliateRoutes.get('/me', requireAuth, requireRole(UserRole.AFFILIATE), affiliateController.getOwnProfile);
affiliateRoutes.get('/me/referrals', requireAuth, requireRole(UserRole.AFFILIATE), affiliateController.getOwnReferrals);
affiliateRoutes.get('/me/manager', requireAuth, requireRole(UserRole.AFFILIATE), affiliateController.getOwnManager);
affiliateRoutes.patch(
  '/me',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(updateOwnProfileSchema),
  affiliateController.updateOwnProfile,
);

// `attachManagerScope` runs once for the whole staff surface below: it pins the
// signed-in manager's own id to the request, which both the per-route permission
// checks and every service call read (issues #5 and #20). An ADMIN passes through it
// unscoped, which is what "sees the whole network" is represented as.
affiliateRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), attachManagerScope);

/**
 * The permission a status change needs depends on which change it is — approving and
 * rejecting an application are separate grants an admin ticks independently, so this
 * cannot be a single static `requirePermission` on the route.
 *
 * PENDING (moving an account back to review) is treated as an edit rather than
 * inventing a fourth grant for a rare administrative correction.
 */
const STATUS_PERMISSION: Record<UserStatus, ManagerPermission> = {
  [UserStatus.ACTIVE]: 'affiliates.approve',
  [UserStatus.REJECTED]: 'affiliates.reject',
  [UserStatus.BLOCKED]: 'affiliates.suspend',
  [UserStatus.INACTIVE]: 'affiliates.suspend',
  [UserStatus.PENDING]: 'affiliates.edit',
};

function requireStatusPermission(req: ScopedRequest, res: Response, next: NextFunction): void {
  const { status } = req.body as UpdateAffiliateStatusDto;
  requirePermission(STATUS_PERMISSION[status])(req, res, next);
}

/**
 * Issue #7 put payout details out of the affiliate's own reach, which makes "who may
 * change them" a real question rather than a formality. Payout fields ride in the same
 * create/update body as everything else, so the check has to look at the body: a
 * manager can be trusted to fix a typo in someone's phone number without also being
 * trusted to redirect where their money goes.
 */
function requirePayoutPermissionIfTouchingPayout(req: ScopedRequest, res: Response, next: NextFunction): void {
  const body = req.body as { payoutMethod?: unknown; payoutDetails?: unknown };
  const touchesPayout = body.payoutMethod !== undefined || (body.payoutDetails !== undefined && Object.keys(body.payoutDetails as object).length > 0);
  if (!touchesPayout) {
    next();
    return;
  }
  requirePermission('affiliates.payout')(req, res, next);
}

affiliateRoutes.get(
  '/',
  requirePermission('affiliates.view'),
  validate(affiliateFiltersSchema, 'query'),
  affiliateController.getAffiliates,
);
affiliateRoutes.get('/:id', requirePermission('affiliates.view'), affiliateController.getAffiliate);
affiliateRoutes.post(
  '/',
  validate(createAffiliateSchema),
  requirePermission('affiliates.create'),
  requirePayoutPermissionIfTouchingPayout,
  affiliateController.createAffiliate,
);
affiliateRoutes.patch(
  '/:id',
  validate(updateAffiliateSchema),
  requirePermission('affiliates.edit'),
  requirePayoutPermissionIfTouchingPayout,
  affiliateController.updateAffiliate,
);
affiliateRoutes.patch(
  '/:id/status',
  validate(updateAffiliateStatusSchema),
  requireStatusPermission,
  affiliateController.updateStatus,
);
affiliateRoutes.patch('/:id/verify-email', requirePermission('affiliates.edit'), affiliateController.markEmailVerified);
affiliateRoutes.post('/:id/impersonate', requirePermission('affiliates.impersonate'), affiliateController.impersonate);
