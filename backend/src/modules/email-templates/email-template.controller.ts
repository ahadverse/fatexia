import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { emailTemplateService } from './email-template.service';
import type { UpdateEmailTemplateDto } from './email-template.dto';

export const emailTemplateController = {
  async getTemplates(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await emailTemplateService.getTemplates());
    } catch (err) {
      next(err);
    }
  },

  async getTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await emailTemplateService.getTemplate(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async updateTemplate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await emailTemplateService.updateTemplate(req.params.id!, req.body as UpdateEmailTemplateDto));
    } catch (err) {
      next(err);
    }
  },
};
