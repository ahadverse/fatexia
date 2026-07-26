import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { affiliatePointService } from './affiliate-point.service';
import type { AdjustPointsDto, PointFiltersDto } from './affiliate-point.dto';

export const affiliatePointController = {
  async getEntries(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliatePointService.getEntries(req.query as unknown as PointFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnPoints(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliatePointService.getOwnPoints(req.user!.id, req.query as unknown as PointFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getBalances(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliatePointService.getBalances());
    } catch (err) {
      next(err);
    }
  },

  async adjust(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await affiliatePointService.adjust(req.body as AdjustPointsDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },
};
