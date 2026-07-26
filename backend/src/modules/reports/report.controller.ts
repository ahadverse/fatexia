import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { affiliateService } from '../affiliates/affiliate.service';
import { reportService } from './report.service';
import type { AffiliateGroupedReportDto, CrOptimizerDto, GroupedReportDto, ReportFiltersDto } from './report.dto';

export const reportController = {
  async getGroupedReport(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getGroupedReport(req.query as unknown as GroupedReportDto));
    } catch (err) {
      next(err);
    }
  },

  async getTrend(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getTrend(req.query as unknown as ReportFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOfferCrOptimizer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getCrOptimizer('offer', req.query as unknown as CrOptimizerDto));
    } catch (err) {
      next(err);
    }
  },

  async getAffiliateCrOptimizer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getCrOptimizer('affiliate', req.query as unknown as CrOptimizerDto));
    } catch (err) {
      next(err);
    }
  },

  async getAffiliateOfferCr(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await reportService.getAffiliateOfferCr(req.query as unknown as ReportFiltersDto));
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
