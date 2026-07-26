import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { offerController } from './offer.controller';
import { createOfferSchema, offerFiltersSchema, updateOfferSchema, updateOfferStatusSchema } from './offer.dto';

export const offerRoutes = Router();

// Affiliate offer browse — registered BEFORE the admin guard below (and ahead of
// `/:id`, which `/available` would otherwise match) with its own AFFILIATE guard.
offerRoutes.get('/available', requireAuth, requireRole(UserRole.AFFILIATE), offerController.getAvailableOffers);

offerRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

offerRoutes.get('/', validate(offerFiltersSchema, 'query'), offerController.getOffers);
offerRoutes.get('/:id', offerController.getOffer);
offerRoutes.post('/', validate(createOfferSchema), offerController.createOffer);
offerRoutes.patch('/:id', validate(updateOfferSchema), offerController.updateOffer);
offerRoutes.patch('/:id/status', validate(updateOfferStatusSchema), offerController.updateOfferStatus);
