import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { integrationService } from './integration.service';
import type { CreateIntegrationDto, UpdateIntegrationDto } from './integration.dto';

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

  async createIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await integrationService.createIntegration(req.body as CreateIntegrationDto));
    } catch (err) {
      next(err);
    }
  },

  async deleteIntegration(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await integrationService.deleteIntegration(req.params.id!);
      res.status(204).send();
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
