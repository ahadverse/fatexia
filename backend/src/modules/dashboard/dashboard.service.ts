import { OfferStatus } from '../offers/offer.entity';
import { UserStatus } from '../users/user.entity';
import { ConversionStatus } from '../conversions/conversion.entity';
import { reportService } from '../reports/report.service';
import type { DashboardDeltasDto, DashboardDto, ReportFiltersDto } from '../reports/report.dto';
import { dashboardRepository } from './dashboard.repository';
import { percentChange, previousWindow } from './period-delta';

// Summing the trend rows is how the current-window totals are derived too, so the
// baseline is measured exactly the same way as the figure it is compared against.
function sumTrend(rows: { clicks: number; conversions: number; revenue: number; payout: number }[]) {
  return rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      conversions: acc.conversions + row.conversions,
      revenue: acc.revenue + row.revenue,
      payout: acc.payout + row.payout,
    }),
    { clicks: 0, conversions: 0, revenue: 0, payout: 0 },
  );
}

type Totals = { clicks: number; conversions: number; revenue: number; payout: number };

const NO_DELTAS: DashboardDeltasDto = {
  clicks: null,
  conversions: null,
  conversionRate: null,
  epc: null,
  revenue: null,
  payout: null,
  profit: null,
};

// Derived metrics are compared as derived metrics — the previous period's rate is
// recomputed from its own clicks/conversions, not inferred from the totals.
function buildDeltas(current: Totals, currentProfit: number, previous: Totals | null): DashboardDeltasDto {
  if (!previous) return NO_DELTAS;

  const rate = (t: Totals) => (t.clicks === 0 ? 0 : (t.conversions / t.clicks) * 100);
  const epc = (t: Totals) => (t.clicks === 0 ? 0 : t.payout / t.clicks);

  return {
    clicks: percentChange(current.clicks, previous.clicks),
    conversions: percentChange(current.conversions, previous.conversions),
    conversionRate: percentChange(rate(current), rate(previous)),
    epc: percentChange(epc(current), epc(previous)),
    revenue: percentChange(current.revenue, previous.revenue),
    payout: percentChange(current.payout, previous.payout),
    profit: percentChange(currentProfit, previous.revenue - previous.payout),
  };
}

// Default window when the caller doesn't pass one. Long enough that a quiet day
// doesn't render an empty dashboard, short enough to stay a "current state" view.
const DEFAULT_WINDOW_DAYS = 30;
const TOP_LIST_SIZE = 5;
// Deliberately not filtered by the selected date range: this panel answers "what is
// happening right now", which is a different question from the windowed figures above
// it. A 30-day window would otherwise render a feed of month-old events as "live".
const ACTIVITY_SIZE = 20;

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
      activeAdvertisers,
      payoutsThisMonth,
      activity,
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
      dashboardRepository.countActiveAdvertisers(),
      dashboardRepository.sumPaidInvoicesThisMonth(windowed.managerScopeId),
      dashboardRepository.getRecentActivity(ACTIVITY_SIZE, windowed.managerScopeId),
    ]);

    // One extra trend query for the preceding window of equal length. Fetched after
    // the batch above rather than inside it so a comparison failure can never take the
    // dashboard down with it — deltas are decoration, the summary is the page.
    const previous = previousWindow(windowed);
    const previousTotals = previous ? sumTrend(await reportService.getTrend(previous)) : null;

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
        activeAdvertisers,
        payoutsThisMonth: Number(payoutsThisMonth.toFixed(2)),
      },
      deltas: buildDeltas(totals, profit, previousTotals),
      trend,
      topOffers,
      topAffiliates,
      topCountries,
      activity,
    };
  },
};
