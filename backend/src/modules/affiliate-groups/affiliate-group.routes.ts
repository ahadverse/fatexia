import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope, requirePermission } from '../../common/guards/manager-scope.guard';
import { UserRole } from '../users/user.entity';
import { affiliateGroupController } from './affiliate-group.controller';
import { createAffiliateGroupSchema, updateAffiliateGroupSchema } from './affiliate-group.dto';

export const affiliateGroupRoutes = Router();

// Groups are an affiliate-management surface, so they sit behind the same grant that
// gates editing an affiliate (issue #20).
affiliateGroupRoutes.use(
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  attachManagerScope,
  requirePermission('affiliates.edit'),
);

affiliateGroupRoutes.get('/', affiliateGroupController.getGroups);
affiliateGroupRoutes.get('/:id', affiliateGroupController.getGroup);
affiliateGroupRoutes.post('/', validate(createAffiliateGroupSchema), affiliateGroupController.createGroup);
affiliateGroupRoutes.patch('/:id', validate(updateAffiliateGroupSchema), affiliateGroupController.updateGroup);
affiliateGroupRoutes.delete('/:id', affiliateGroupController.deleteGroup);
