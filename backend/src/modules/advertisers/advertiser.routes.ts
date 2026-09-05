import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope, requirePermission } from '../../common/guards/manager-scope.guard';
import { UserRole } from '../users/user.entity';
import { advertiserController } from './advertiser.controller';
import {
  advertiserFiltersSchema,
  createAdvertiserSchema,
  updateAdvertiserSchema,
  updateAdvertiserStatusSchema,
} from './advertiser.dto';

export const advertiserRoutes = Router();

advertiserRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER), attachManagerScope);

// Reads stay open to any staff login: the offer form's advertiser dropdown needs this
// list, so gating it would break offer creation for a manager who legitimately has
// offers.create. Only the writes are behind advertisers.manage (issue #20).
advertiserRoutes.get('/', validate(advertiserFiltersSchema, 'query'), advertiserController.getAdvertisers);
advertiserRoutes.get('/:id', advertiserController.getAdvertiser);
advertiserRoutes.post(
  '/',
  requirePermission('advertisers.manage'),
  validate(createAdvertiserSchema),
  advertiserController.createAdvertiser,
);
advertiserRoutes.patch(
  '/:id',
  requirePermission('advertisers.manage'),
  validate(updateAdvertiserSchema),
  advertiserController.updateAdvertiser,
);
advertiserRoutes.patch(
  '/:id/status',
  requirePermission('advertisers.manage'),
  validate(updateAdvertiserStatusSchema),
  advertiserController.updateStatus,
);
