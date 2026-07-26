import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { emailTemplateController } from './email-template.controller';
import { updateEmailTemplateSchema } from './email-template.dto';

// Admin-only: transactional email copy goes to real customers, and Managers are
// locked out of network-wide configuration (PLAN-backend.md permission matrix).
export const emailTemplateRoutes = Router();

emailTemplateRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

emailTemplateRoutes.get('/', emailTemplateController.getTemplates);
emailTemplateRoutes.get('/:id', emailTemplateController.getTemplate);
emailTemplateRoutes.patch('/:id', validate(updateEmailTemplateSchema), emailTemplateController.updateTemplate);
