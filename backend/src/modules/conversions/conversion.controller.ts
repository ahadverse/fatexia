import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import type { ScopedRequest } from '../../common/guards/manager-scope.guard';
import { scopedQuery } from '../../common/manager-scope-sql';
import { conversionService } from './conversion.service';
import type { ConversionFiltersDto, OwnConversionFiltersDto, UpdateConversionStatusDto } from './conversion.dto';

export const conversionController = {
  // Scoped to the signed-in manager's own affiliates; unrestricted for an admin
  // (issue #5). The session value is applied last, so it overrides any in the query.
  async getConversions(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await conversionService.getConversions(scopedQuery<ConversionFiltersDto>(req.query, req.managerScope?.managerId)));
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
