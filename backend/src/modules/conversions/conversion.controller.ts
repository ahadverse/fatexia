import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { conversionService } from './conversion.service';
import type { ConversionFiltersDto, OwnConversionFiltersDto, UpdateConversionStatusDto } from './conversion.dto';

export const conversionController = {
  async getConversions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await conversionService.getConversions(req.query as unknown as ConversionFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnConversions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await conversionService.getOwnConversions(req.user!.id, req.query as unknown as OwnConversionFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getConversion(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await conversionService.getConversion(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await conversionService.updateStatus(req.params.id!, req.body as UpdateConversionStatusDto));
    } catch (err) {
      next(err);
    }
  },
};
