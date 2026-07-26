import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { offerAccessRequestController } from './offer-access-request.controller';
import {
  accessRequestFiltersSchema,
  createAccessRequestSchema,
  decideAccessRequestSchema,
} from './offer-access-request.dto';

export const offerAccessRequestRoutes = Router();

// Affiliate side first — `/mine` is registered ahead of the admin guard and of any
// `/:id` route that would otherwise swallow it.
offerAccessRequestRoutes.get('/mine', requireAuth, requireRole(UserRole.AFFILIATE), offerAccessRequestController.getOwnRequests);
offerAccessRequestRoutes.post(
  '/',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(createAccessRequestSchema),
  offerAccessRequestController.createRequest,
);

offerAccessRequestRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

offerAccessRequestRoutes.get('/', validate(accessRequestFiltersSchema, 'query'), offerAccessRequestController.getRequests);
offerAccessRequestRoutes.patch('/:id/decision', validate(decideAccessRequestSchema), offerAccessRequestController.decide);
