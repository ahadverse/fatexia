import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { smartLinkController } from './smart-link.controller';
import { createSmartLinkSchema, smartLinkFiltersSchema, updateSmartLinkSchema } from './smart-link.dto';

export const smartLinkRoutes = Router();

// Affiliates read the active list to grab their link; only admins author them.
smartLinkRoutes.get(
  '/',
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER, UserRole.AFFILIATE),
  validate(smartLinkFiltersSchema, 'query'),
  smartLinkController.getSmartLinks,
);

smartLinkRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

smartLinkRoutes.get('/:id', smartLinkController.getSmartLink);
smartLinkRoutes.post('/', validate(createSmartLinkSchema), smartLinkController.createSmartLink);
smartLinkRoutes.patch('/:id', validate(updateSmartLinkSchema), smartLinkController.updateSmartLink);
smartLinkRoutes.delete('/:id', smartLinkController.deleteSmartLink);
