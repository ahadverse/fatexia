import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import type { ScopedRequest } from '../../common/guards/manager-scope.guard';
import { scopedQuery } from '../../common/manager-scope-sql';
import { dashboardService } from './dashboard.service';
import { affiliateDashboardService } from './affiliate-dashboard.service';
import type { ReportFiltersDto } from '../reports/report.dto';

export const dashboardController = {
  // The traffic figures flow through reportService, so passing the scope here makes
  // every click/conversion/revenue number on a manager's dashboard their own book
  // (issue #5). The network-wide *counts* alongside them — how many offers and
  // affiliates exist — are not scoped; they carry no money and no per-affiliate data.
  async getDashboard(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await dashboardService.getDashboard(scopedQuery<ReportFiltersDto>(req.query, req.managerScope?.managerId)));
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
