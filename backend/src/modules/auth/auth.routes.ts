import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { authController } from './auth.controller';
import {
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resendVerificationSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from './auth.dto';

export const authRoutes = Router();

authRoutes.post('/register', validate(registerSchema), authController.register);
authRoutes.post('/login', validate(loginSchema), authController.login);
authRoutes.post('/refresh', validate(refreshSchema), authController.refresh);
authRoutes.get('/me', requireAuth, authController.me);
authRoutes.post('/verify-email', validate(verifyEmailSchema), authController.verifyEmail);
authRoutes.post('/resend-verification', validate(resendVerificationSchema), authController.resendVerification);

// Both unauthenticated by necessity — the whole point is that the caller cannot log
// in. `forgot-password` answers identically whether or not the address exists, so it
// cannot be used to enumerate accounts (see authService.forgotPassword).
authRoutes.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
authRoutes.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
