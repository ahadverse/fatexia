import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { geoipService } from './geoip.service';

export const geoipController = {
  async getStatus(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await geoipService.getStatus());
    } catch (err) {
      next(err);
    }
  },

  async fetchNow(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await geoipService.fetchNow());
    } catch (err) {
      next(err);
    }
  },
};
