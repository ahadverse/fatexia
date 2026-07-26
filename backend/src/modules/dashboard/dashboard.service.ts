import { OfferStatus } from '../offers/offer.entity';
import { UserStatus } from '../users/user.entity';
import { ConversionStatus } from '../conversions/conversion.entity';
import { reportService } from '../reports/report.service';
import type { DashboardDto, ReportFiltersDto } from '../reports/report.dto';
import { dashboardRepository } from './dashboard.repository';

// Default window when the caller doesn't pass one. Long enough that a quiet day
// doesn't render an empty dashboard, short enough to stay a "current state" view.
const DEFAULT_WINDOW_DAYS = 30;
const TOP_LIST_SIZE = 5;

function defaultFilters(filters: ReportFiltersDto): ReportFiltersDto {
  if (filters.dateFrom || filters.dateTo) return filters;
  const from = new Date();
  from.setDate(from.getDate() - DEFAULT_WINDOW_DAYS);
  return { ...filters, dateFrom: from.toISOString() };
}

export const dashboardService = {
  async getDashboard(filters: ReportFiltersDto): Promise<DashboardDto> {
    const windowed = defaultFilters(filters);

    const [
      trend,
      topOffers,
      topAffiliates,
      topCountries,
      activeOffers,
      pendingOffers,
      activeAffiliates,
      pendingAffiliates,
      pendingConversions,
      pendingAccessRequests,
      pendingInvoices,
      unreadMessages,
      clickQuality,
    ] = await Promise.all([
      reportService.getTrend(windowed),
      reportService.getTopRows('offer', windowed, TOP_LIST_SIZE, 'clicks'),
      // Ranked by the metric the dashboard card actually displays.
      reportService.getTopRows('affiliate', windowed, TOP_LIST_SIZE, 'payout'),
      reportService.getTopRows('country', windowed, TOP_LIST_SIZE, 'clicks'),
      dashboardRepository.countOffersByStatus(OfferStatus.APPROVED),
      dashboardRepository.countOffersByStatus(OfferStatus.PENDING),
      dashboardRepository.countAffiliatesByStatus(UserStatus.ACTIVE),
      dashboardRepository.countAffiliatesByStatus(UserStatus.PENDING),
      dashboardRepository.countConversionsByStatus(ConversionStatus.PENDING),
      dashboardRepository.countPendingAccessRequests(),
      dashboardRepository.countPendingInvoices(),
      dashboardRepository.countUnreadMessages(),
      dashboardRepository.countClicksByQuality(windowed.dateFrom ? new Date(windowed.dateFrom) : null),
    ]);

    // Traffic totals come from the trend rows so the tiles and the chart are summing
    // exactly the same data — two independent queries could disagree at a day boundary.
    const totals = trend.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        conversions: acc.conversions + row.conversions,
        approved: acc.approved + row.approvedConversions,
        revenue: acc.revenue + row.revenue,
        payout: acc.payout + row.payout,
      }),
      { clicks: 0, conversions: 0, approved: 0, revenue: 0, payout: 0 },
    );

    const profit = totals.revenue - totals.payout;

    return {
      summary: {
        clicks: totals.clicks,
        conversions: totals.conversions,
        approvedConversions: totals.approved,
        pendingConversions,
        conversionRate: totals.clicks === 0 ? 0 : Number(((totals.conversions / totals.clicks) * 100).toFixed(2)),
        revenue: Number(totals.revenue.toFixed(2)),
        payout: Number(totals.payout.toFixed(2)),
        profit: Number(profit.toFixed(2)),
        epc: totals.clicks === 0 ? 0 : Number((totals.payout / totals.clicks).toFixed(4)),
        activeOffers,
        pendingOffers,
        activeAffiliates,
        pendingAffiliates,
        pendingAccessRequests,
        pendingInvoices,
        unreadMessages,
        blockedClicks: clickQuality.blocked,
        suspectClicks: clickQuality.suspect,
      },
      trend,
      topOffers,
      topAffiliates,
      topCountries,
    };
  },
};
