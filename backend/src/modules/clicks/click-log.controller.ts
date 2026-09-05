import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import type { ScopedRequest } from '../../common/guards/manager-scope.guard';
import { scopedQuery } from '../../common/manager-scope-sql';
import { clickLogService } from './click-log.service';
import type { ClickLogFiltersDto } from './click.dto';

export const clickLogController = {
  // Scoped to the signed-in manager's own affiliates; unrestricted for an admin
  // (issue #5). The session value is applied last, so it overrides any in the query.
  async getLogs(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await clickLogService.getLogs(scopedQuery<ClickLogFiltersDto>(req.query, req.managerScope?.managerId)));
    } catch (err) {
      next(err);
    }
  },

  async getOwnLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await clickLogService.getOwnLogs(req.user!.id, req.query as unknown as ClickLogFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  // Powers the country filter dropdown — only countries that actually have traffic.
  async getCountries(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await clickLogService.getCountries());
    } catch (err) {
      next(err);
    }
  },

  async getOwnCountries(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await clickLogService.getOwnCountries(req.user!.id));
    } catch (err) {
      next(err);
    }
  },
};
