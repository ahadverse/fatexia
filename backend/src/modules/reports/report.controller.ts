import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import type { ScopedRequest } from '../../common/guards/manager-scope.guard';
import { scopedQuery } from '../../common/manager-scope-sql';
import { affiliateService } from '../affiliates/affiliate.service';
import { reportService } from './report.service';
import type { AffiliateGroupedReportDto, CrOptimizerDto, GroupedReportDto, ReportFiltersDto } from './report.dto';

export const reportController = {
  // Every staff-facing report below runs `scopedQuery`, which pins the rows to the
  // signed-in manager's own affiliates and leaves an admin unrestricted (issue #5).
  // The session value is applied last, so a `managerScopeId` in the query string is
  // overwritten rather than honoured.
  async getGroupedReport(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getGroupedReport(scopedQuery<GroupedReportDto>(req.query, req.managerScope?.managerId)));
    } catch (err) {
      next(err);
    }
  },

  async getTrend(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getTrend(scopedQuery<ReportFiltersDto>(req.query, req.managerScope?.managerId)));
    } catch (err) {
      next(err);
    }
  },

  async getOfferCrOptimizer(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getCrOptimizer('offer', scopedQuery<CrOptimizerDto>(req.query, req.managerScope?.managerId)));
    } catch (err) {
      next(err);
    }
  },

  async getAffiliateCrOptimizer(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getCrOptimizer('affiliate', scopedQuery<CrOptimizerDto>(req.query, req.managerScope?.managerId)));
    } catch (err) {
      next(err);
    }
  },

  async getAffiliateOfferCr(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getAffiliateOfferCr(scopedQuery<ReportFiltersDto>(req.query, req.managerScope?.managerId)));
    } catch (err) {
      next(err);
    }
  },

  // Affiliate self-service. The affiliate id comes from the JWT, never the query.
  async getOwnReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const affiliateId = await affiliateService.resolveAffiliateId(req.user!.id);
      res.json(await reportService.getAffiliateGroupedReport(affiliateId, req.query as unknown as AffiliateGroupedReportDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnTrend(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const affiliateId = await affiliateService.resolveAffiliateId(req.user!.id);
      res.json(await reportService.getAffiliateTrend(affiliateId, req.query as unknown as ReportFiltersDto));
    } catch (err) {
      next(err);
    }
  },
};
