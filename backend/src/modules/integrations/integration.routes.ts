import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { integrationController } from './integration.controller';
import { updateIntegrationSchema } from './integration.dto';

// Strictly ADMIN — this is the one place third-party credentials are entered, and
// Managers are explicitly excluded (PLAN-admin.md security note).
export const integrationRoutes = Router();

integrationRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

integrationRoutes.get('/', integrationController.getIntegrations);
integrationRoutes.get('/:id', integrationController.getIntegration);
integrationRoutes.patch('/:id', validate(updateIntegrationSchema), integrationController.updateIntegration);
// POST, not GET: it makes a real outbound call and writes lastCheckedAt/lastError.
integrationRoutes.post('/:id/test', integrationController.testIntegration);
