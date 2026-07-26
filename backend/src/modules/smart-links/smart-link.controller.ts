import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { smartLinkService } from './smart-link.service';
import type { CreateSmartLinkDto, SmartLinkFiltersDto, UpdateSmartLinkDto } from './smart-link.dto';

export const smartLinkController = {
  async getSmartLinks(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await smartLinkService.getSmartLinks(req.query as unknown as SmartLinkFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getSmartLink(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await smartLinkService.getSmartLink(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createSmartLink(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await smartLinkService.createSmartLink(req.body as CreateSmartLinkDto));
    } catch (err) {
      next(err);
    }
  },

  async updateSmartLink(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await smartLinkService.updateSmartLink(req.params.id!, req.body as UpdateSmartLinkDto));
    } catch (err) {
      next(err);
    }
  },

  async deleteSmartLink(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await smartLinkService.deleteSmartLink(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
