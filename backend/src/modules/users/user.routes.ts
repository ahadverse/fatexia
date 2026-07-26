import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { userController } from './user.controller';
import { changePasswordSchema } from './user.dto';

// Mounted at /users. Self-service + admin reads; the service enforces access.
export const userRoutes = Router();

userRoutes.patch('/me/password', requireAuth, validate(changePasswordSchema), userController.changePassword);
userRoutes.get('/:id', requireAuth, userController.getUser);
