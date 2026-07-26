import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { reportController } from './report.controller';
import { affiliateGroupedReportSchema, crOptimizerSchema, groupedReportSchema, reportFiltersSchema } from './report.dto';

// One grouped endpoint backs Performance, Sub-ID Tracking, Advanced Reports and the
// per-offer/affiliate/advertiser report pages — they differ only by `groupBy`, so
// they share a query path rather than getting an endpoint each.
export const reportRoutes = Router();

// Affiliate self-service reporting, registered ahead of the admin guard. These return
// AffiliateReportRowDto, which has no revenue/profit/margin fields — affiliates never
// see network revenue (PLAN-affiliate-portal.md's hard rule).
reportRoutes.get(
  '/mine/grouped',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(affiliateGroupedReportSchema, 'query'),
  reportController.getOwnReport,
);
reportRoutes.get(
  '/mine/trend',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(reportFiltersSchema, 'query'),
  reportController.getOwnTrend,
);

reportRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

reportRoutes.get('/grouped', validate(groupedReportSchema, 'query'), reportController.getGroupedReport);
reportRoutes.get('/trend', validate(reportFiltersSchema, 'query'), reportController.getTrend);
reportRoutes.get('/cr/offers', validate(crOptimizerSchema, 'query'), reportController.getOfferCrOptimizer);
reportRoutes.get('/cr/affiliates', validate(crOptimizerSchema, 'query'), reportController.getAffiliateCrOptimizer);
reportRoutes.get('/cr/affiliate-offer', validate(reportFiltersSchema, 'query'), reportController.getAffiliateOfferCr);
