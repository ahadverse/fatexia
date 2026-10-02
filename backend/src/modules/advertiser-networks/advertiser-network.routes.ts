import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { advertiserNetworkController } from './advertiser-network.controller';
import { advertiserNetworkInputSchema } from './advertiser-network.dto';

export const advertiserNetworkRoutes = Router();

advertiserNetworkRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

advertiserNetworkRoutes.get('/', advertiserNetworkController.list);
advertiserNetworkRoutes.post('/', validate(advertiserNetworkInputSchema), advertiserNetworkController.create);
advertiserNetworkRoutes.put('/:id', validate(advertiserNetworkInputSchema), advertiserNetworkController.update);
advertiserNetworkRoutes.delete('/:id', advertiserNetworkController.remove);
