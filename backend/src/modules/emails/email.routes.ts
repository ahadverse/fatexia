import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { emailController } from './email.controller';
import { previewEmailSchema, sendEmailSchema } from './email.dto';

export const emailRoutes = Router();

// ADMIN only, not MANAGER: this sends mail from the network's own address to any
// address an operator types, which is a wider reach than a manager's scoped duties
// (see PLAN-backend.md's permission matrix).
emailRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

emailRoutes.post('/send', validate(sendEmailSchema), emailController.send);
emailRoutes.post('/preview', validate(previewEmailSchema), emailController.preview);
