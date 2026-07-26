import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { advertiserService } from './advertiser.service';
import type {
  AdvertiserFiltersDto,
  CreateAdvertiserDto,
  UpdateAdvertiserDto,
  UpdateAdvertiserStatusDto,
} from './advertiser.dto';

export const advertiserController = {
  async getAdvertisers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await advertiserService.getAdvertisers(req.query as unknown as AdvertiserFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getAdvertiser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await advertiserService.getAdvertiser(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createAdvertiser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await advertiserService.createAdvertiser(req.body as CreateAdvertiserDto));
    } catch (err) {
      next(err);
    }
  },

  async updateAdvertiser(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await advertiserService.updateAdvertiser(req.params.id!, req.body as UpdateAdvertiserDto));
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await advertiserService.updateStatus(req.params.id!, req.body as UpdateAdvertiserStatusDto));
    } catch (err) {
      next(err);
    }
  },
};
