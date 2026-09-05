import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { attachManagerScope, requirePermission } from '../../common/guards/manager-scope.guard';
import { UserRole } from '../users/user.entity';
import { conversionController } from './conversion.controller';
import { conversionFiltersSchema, ownConversionFiltersSchema, updateConversionStatusSchema } from './conversion.dto';

export const conversionRoutes = Router();

// Affiliate self-service, ahead of the admin guard and of `/:id`. Returns
// OwnConversionDto — payout only, no revenue or profit field exists on it.
conversionRoutes.get(
  '/mine',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(ownConversionFiltersSchema, 'query'),
  conversionController.getOwnConversions,
);

conversionRoutes.use(
  requireAuth,
  requireRole(UserRole.ADMIN, UserRole.MANAGER),
  attachManagerScope,
  requirePermission('reports.view'),
);

conversionRoutes.get('/', validate(conversionFiltersSchema, 'query'), conversionController.getConversions);
conversionRoutes.get('/:id', conversionController.getConversion);
conversionRoutes.patch('/:id/status', validate(updateConversionStatusSchema), conversionController.updateStatus);
