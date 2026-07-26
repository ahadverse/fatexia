import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { advertiserController } from './advertiser.controller';
import {
  advertiserFiltersSchema,
  createAdvertiserSchema,
  updateAdvertiserSchema,
  updateAdvertiserStatusSchema,
} from './advertiser.dto';

export const advertiserRoutes = Router();

advertiserRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

advertiserRoutes.get('/', validate(advertiserFiltersSchema, 'query'), advertiserController.getAdvertisers);
advertiserRoutes.get('/:id', advertiserController.getAdvertiser);
advertiserRoutes.post('/', validate(createAdvertiserSchema), advertiserController.createAdvertiser);
advertiserRoutes.patch('/:id', validate(updateAdvertiserSchema), advertiserController.updateAdvertiser);
advertiserRoutes.patch('/:id/status', validate(updateAdvertiserStatusSchema), advertiserController.updateStatus);
