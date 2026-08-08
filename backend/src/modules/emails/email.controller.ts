import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { emailService } from './email.service';
import type { PreviewEmailDto, SendEmailDto } from './email.dto';

export const emailController = {
  async send(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await emailService.sendManual(req.body as SendEmailDto));
    } catch (err) {
      next(err);
    }
  },

  async preview(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await emailService.preview(req.body as PreviewEmailDto));
    } catch (err) {
      next(err);
    }
  },
};
