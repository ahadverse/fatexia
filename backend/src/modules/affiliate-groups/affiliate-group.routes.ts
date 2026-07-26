import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { affiliateGroupController } from './affiliate-group.controller';
import { createAffiliateGroupSchema, updateAffiliateGroupSchema } from './affiliate-group.dto';

export const affiliateGroupRoutes = Router();

affiliateGroupRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

affiliateGroupRoutes.get('/', affiliateGroupController.getGroups);
affiliateGroupRoutes.get('/:id', affiliateGroupController.getGroup);
affiliateGroupRoutes.post('/', validate(createAffiliateGroupSchema), affiliateGroupController.createGroup);
affiliateGroupRoutes.patch('/:id', validate(updateAffiliateGroupSchema), affiliateGroupController.updateGroup);
affiliateGroupRoutes.delete('/:id', affiliateGroupController.deleteGroup);
