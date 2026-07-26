import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { integrationService } from './integration.service';
import type { UpdateIntegrationDto } from './integration.dto';

export const integrationController = {
  async getIntegrations(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await integrationService.getIntegrations());
    } catch (err) {
      next(err);
    }
  },

  async getIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await integrationService.getIntegration(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async updateIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await integrationService.updateIntegration(req.params.id!, req.body as UpdateIntegrationDto));
    } catch (err) {
      next(err);
    }
  },

  async testIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await integrationService.testIntegration(req.params.id!));
    } catch (err) {
      next(err);
    }
  },
};
