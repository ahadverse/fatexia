import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { advertiserNetworkService } from './advertiser-network.service';
import type { AdvertiserNetworkInputDto } from './advertiser-network.dto';

export const advertiserNetworkController = {
  async list(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await advertiserNetworkService.list());
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await advertiserNetworkService.create(req.body as AdvertiserNetworkInputDto));
    } catch (err) {
      next(err);
    }
  },

  async update(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await advertiserNetworkService.update(req.params.id!, req.body as AdvertiserNetworkInputDto));
    } catch (err) {
      next(err);
    }
  },

  async remove(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await advertiserNetworkService.remove(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
