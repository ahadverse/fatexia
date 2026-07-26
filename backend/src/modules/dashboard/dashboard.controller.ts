import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { dashboardService } from './dashboard.service';
import { affiliateDashboardService } from './affiliate-dashboard.service';
import type { ReportFiltersDto } from '../reports/report.dto';

export const dashboardController = {
  async getDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await dashboardService.getDashboard(req.query as unknown as ReportFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnDashboard(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateDashboardService.getDashboard(req.user!.id, req.query as unknown as ReportFiltersDto));
    } catch (err) {
      next(err);
    }
  },
};
