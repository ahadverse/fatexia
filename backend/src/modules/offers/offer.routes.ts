import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope, requirePermission } from '../../common/guards/manager-scope.guard';
import { UserRole } from '../users/user.entity';
import { offerController } from './offer.controller';
import {
  createOfferSchema,
  offerFiltersSchema,
  setOfferFavouriteSchema,
  updateOfferSchema,
  updateOfferStatusSchema,
} from './offer.dto';

export const offerRoutes = Router();

// Affiliate offer browse — registered BEFORE the staff guard below (and ahead of
// `/:id`, which `/available` would otherwise match) with its own AFFILIATE guard.
offerRoutes.get('/available', requireAuth, requireRole(UserRole.AFFILIATE), offerController.getAvailableOffers);
// The affiliate detail page. Nested under `/available` rather than sitting at
// `/:id/affiliate` so it stays on the affiliate side of the staff guard below, and so
// the URL says plainly that this is the browsable projection, not the admin one.
offerRoutes.get('/available/:id', requireAuth, requireRole(UserRole.AFFILIATE), offerController.getAvailableOffer);
offerRoutes.put(
  '/available/:id/favourite',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(setOfferFavouriteSchema),
  offerController.setOfferFavourite,
);

// Managers reach offers through the permission grid rather than not at all (issue
// #20): an admin who wants a manager building offers ticks offers.create, and one who
// doesn't leaves every offers.* box clear, which is the default for a new manager.
offerRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), attachManagerScope);

offerRoutes.get('/', requirePermission('offers.view'), validate(offerFiltersSchema, 'query'), offerController.getOffers);
offerRoutes.get('/:id', requirePermission('offers.view'), offerController.getOffer);
offerRoutes.post('/', requirePermission('offers.create'), validate(createOfferSchema), offerController.createOffer);
offerRoutes.patch('/:id', requirePermission('offers.edit'), validate(updateOfferSchema), offerController.updateOffer);
offerRoutes.patch(
  '/:id/status',
  requirePermission('offers.edit'),
  validate(updateOfferStatusSchema),
  offerController.updateOfferStatus,
);
