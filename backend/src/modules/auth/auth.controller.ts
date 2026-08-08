import type { NextFunction, Request, Response } from 'express';
import { authService } from './auth.service';
import type { LoginDto, RefreshDto, RegisterDto, ResendVerificationDto, VerifyEmailDto } from './auth.dto';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';

export const authController = {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.register(req.body as RegisterDto);
      res.status(201).json(user);
    } catch (err) {
      next(err);
    }
  },

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body as LoginDto;
      const tokens = await authService.login(email, password, {
        ip: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? null,
      });
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body as RefreshDto;
      const tokens = await authService.refresh(refreshToken);
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },

  async me(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const user = await authService.me(req.user!.id);
      res.json(user);
    } catch (err) {
      next(err);
    }
  },

  async verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await authService.verifyEmail(req.body as VerifyEmailDto));
    } catch (err) {
      next(err);
    }
  },

  async resendVerification(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await authService.resendVerification(req.body as ResendVerificationDto));
    } catch (err) {
      next(err);
    }
  },
};
