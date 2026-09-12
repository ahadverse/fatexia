import { IsNull } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { ConversionStatus } from '../conversions/conversion.entity';
import { Conversion } from '../conversions/conversion.entity';
import { Message, MessageDirection } from '../messages/message.entity';
import { affiliateService } from '../affiliates/affiliate.service';
import { affiliatePointRepository } from '../affiliate-points/affiliate-point.repository';
import { invoiceService } from '../invoices/invoice.service';
import { offerService } from '../offers/offer.service';
import { reportService } from '../reports/report.service';
import type { AffiliateDashboardDto, ReportFiltersDto } from '../reports/report.dto';
import { dashboardRepository } from './dashboard.repository';
import { percentChange, previousWindow } from './period-delta';

type Totals = { clicks: number; uniqueClicks: number; conversions: number; payout: number };

function sumTrend(rows: { clicks: number; uniqueClicks: number; conversions: number; payout: number }[]): Totals {
  return rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      uniqueClicks: acc.uniqueClicks + row.uniqueClicks,
      conversions: acc.conversions + row.conversions,
      payout: acc.payout + row.payout,
    }),
    { clicks: 0, uniqueClicks: 0, conversions: 0, payout: 0 },
  );
}

const NO_DELTAS = {
  clicks: null,
  uniqueClicks: null,
  conversions: null,
  conversionRate: null,
  epc: null,
  payout: null,
};

function buildDeltas(current: Totals, previous: Totals | null): AffiliateDashboardDto['deltas'] {
  if (!previous) return NO_DELTAS;

  const rate = (t: Totals) => (t.clicks === 0 ? 0 : (t.conversions / t.clicks) * 100);
  const epc = (t: Totals) => (t.clicks === 0 ? 0 : t.payout / t.clicks);

  return {
    clicks: percentChange(current.clicks, previous.clicks),
    uniqueClicks: percentChange(current.uniqueClicks, previous.uniqueClicks),
    conversions: percentChange(current.conversions, previous.conversions),
    conversionRate: percentChange(rate(current), rate(previous)),
    epc: percentChange(epc(current), epc(previous)),
    payout: percentChange(current.payout, previous.payout),
  };
}

/**
 * The affiliate portal's dashboard.
 *
 * Kept separate from the admin dashboard service rather than parameterised by role:
 * the two return different shapes on purpose. This one is payout-only — there is no
 * revenue, profit or margin field anywhere in AffiliateDashboardDto, so the money
 * -visibility rule holds structurally rather than by remembering to zero a field.
 */

const DEFAULT_WINDOW_DAYS = 30;
const TOP_LIST_SIZE = 5;
// Not filtered by the selected date range — see the same constant in dashboard.service.ts.
const ACTIVITY_SIZE = 20;

function defaultFilters(filters: ReportFiltersDto): ReportFiltersDto {
  if (filters.dateFrom || filters.dateTo) return filters;
  const from = new Date();
  from.setDate(from.getDate() - DEFAULT_WINDOW_DAYS);
  return { ...filters, dateFrom: from.toISOString() };
}

export const affiliateDashboardService = {
  async getDashboard(userId: string, filters: ReportFiltersDto): Promise<AffiliateDashboardDto> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    const windowed = defaultFilters(filters);

    const [trend, topOffers, availableOffers, balance, pointBalances, pendingConversions, unreadMessages, activity] =
      await Promise.all([
        reportService.getAffiliateTrend(affiliateId, windowed),
        reportService.getAffiliateTopRows('offer', affiliateId, windowed, TOP_LIST_SIZE),
        offerService.getAvailableOffers({ id: userId }),
        invoiceService.getOwnBalance(userId),
        affiliatePointRepository.balances(),
        AppDataSource.getRepository(Conversion).count({
          where: { affiliateId, status: ConversionStatus.PENDING },
        }),
        // Outbound = network → this affiliate; those are the ones they have not read.
        AppDataSource.getRepository(Message).count({
          where: { affiliateId, direction: MessageDirection.OUTBOUND, readAt: IsNull() },
        }),
        dashboardRepository.getAffiliateRecentActivity(affiliateId, ACTIVITY_SIZE),
      ]);

    // Totals come from the same trend rows the chart draws, so the tiles and the chart
    // cannot disagree at a day boundary.
    const totals = trend.reduce(
      (acc, row) => ({
        clicks: acc.clicks + row.clicks,
        uniqueClicks: acc.uniqueClicks + row.uniqueClicks,
        conversions: acc.conversions + row.conversions,
        approved: acc.approved + row.approvedConversions,
        payout: acc.payout + row.payout,
      }),
      { clicks: 0, uniqueClicks: 0, conversions: 0, approved: 0, payout: 0 },
    );

    // One extra trend query for the preceding window of equal length. Run after the
    // batch above so a comparison failure can never take the dashboard down with it —
    // deltas are decoration, the summary is the page.
    const previous = previousWindow(windowed);
    const previousTotals = previous ? sumTrend(await reportService.getAffiliateTrend(affiliateId, previous)) : null;

    const points = pointBalances.find((row) => row.affiliateId === affiliateId);

    return {
      summary: {
        clicks: totals.clicks,
        uniqueClicks: totals.uniqueClicks,
        conversions: totals.conversions,
        approvedConversions: totals.approved,
        pendingConversions,
        conversionRate: totals.clicks === 0 ? 0 : Number(((totals.conversions / totals.clicks) * 100).toFixed(2)),
        payout: Number(totals.payout.toFixed(2)),
        epc: totals.clicks === 0 ? 0 : Number((totals.payout / totals.clicks).toFixed(4)),
        availableOffers: availableOffers.length,
        pendingPayout: balance.eligibleAmount,
        totalPoints: Number(points?.totalPoints ?? 0),
        unreadMessages,
      },
      deltas: buildDeltas(totals, previousTotals),
      activity,
      trend,
      topOffers,
    };
  },
};
