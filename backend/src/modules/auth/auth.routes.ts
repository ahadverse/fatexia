import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { authController } from './auth.controller';
import { loginSchema, refreshSchema, registerSchema, resendVerificationSchema, verifyEmailSchema } from './auth.dto';

export const authRoutes = Router();

authRoutes.post('/register', validate(registerSchema), authController.register);
authRoutes.post('/login', validate(loginSchema), authController.login);
authRoutes.post('/refresh', validate(refreshSchema), authController.refresh);
authRoutes.get('/me', requireAuth, authController.me);
authRoutes.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
authRoutes.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);
