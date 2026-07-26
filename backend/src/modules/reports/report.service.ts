import { advertiserNames, affiliateNames, offerNames, type NameMap } from '../../common/entity-names';
import { reportRepository } from './report.repository';
import type {
  AffiliateGroupedReportDto,
  AffiliateGroupedReportResultDto,
  AffiliateReportRowDto,
  AffiliateReportTotalsDto,
  AffiliateOfferCrDto,
  CrAnomalyDto,
  CrOptimizerDto,
  GroupedReportDto,
  GroupedReportResultDto,
  ReportDimension,
  ReportFiltersDto,
  ReportRowDto,
  ReportTotalsDto,
} from './report.dto';

// Rate helpers. A zero denominator means "no data", which is 0 — not NaN, and not a
// division that would surface as `null` in the JSON.
function rate(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(2));
}

function perUnit(total: number, units: number): number {
  if (units === 0) return 0;
  return Number((total / units).toFixed(4));
}

function money(value: number): number {
  return Number(value.toFixed(2));
}

// A null group key means the source column was empty (no country resolved, no sub-id
// passed). Reported explicitly rather than dropped — "unknown" is a real bucket, and
// hiding it would make the rows fail to sum to the totals.
const UNKNOWN_KEY = '(none)';

function normalizeKey(key: string | null): string {
  return key ?? UNKNOWN_KEY;
}

async function labelsFor(dimension: ReportDimension, keys: string[]): Promise<NameMap> {
  const real = keys.filter((key) => key !== UNKNOWN_KEY);
  if (dimension === 'offer') return offerNames(real);
  if (dimension === 'affiliate') return affiliateNames(real);
  if (dimension === 'advertiser') return advertiserNames(real);
  return new Map();
}

interface MergedRow {
  clicks: number;
  uniqueClicks: number;
  // Selected by the aggregate query anyway; previously read from SQL and then dropped
  // on the floor here. Now carried through to the admin totals.
  blockedClicks: number;
  suspectClicks: number;
  conversions: number;
  approved: number;
  rejected: number;
  revenue: number;
  payout: number;
}

function emptyRow(): MergedRow {
  return {
    clicks: 0,
    uniqueClicks: 0,
    blockedClicks: 0,
    suspectClicks: 0,
    conversions: 0,
    approved: 0,
    rejected: 0,
    revenue: 0,
    payout: 0,
  };
}

async function mergeAggregates(dimension: ReportDimension, filters: ReportFiltersDto): Promise<Map<string, MergedRow>> {
  const [clickRows, conversionRows] = await Promise.all([
    reportRepository.clickAggregates(dimension, filters),
    reportRepository.conversionAggregates(dimension, filters),
  ]);

  const merged = new Map<string, MergedRow>();

  for (const row of clickRows) {
    const key = normalizeKey(row.key);
    const entry = merged.get(key) ?? emptyRow();
    entry.clicks += Number(row.clicks);
    entry.uniqueClicks += Number(row.uniqueClicks);
    entry.blockedClicks += Number(row.blockedClicks);
    entry.suspectClicks += Number(row.suspectClicks);
    merged.set(key, entry);
  }

  // A conversion whose key has no matching click row still gets a bucket — otherwise
  // an orphan or cross-period conversion would vanish from the report entirely.
  for (const row of conversionRows) {
    const key = normalizeKey(row.key);
    const entry = merged.get(key) ?? emptyRow();
    entry.conversions += Number(row.conversions);
    entry.approved += Number(row.approved);
    entry.rejected += Number(row.rejected);
    entry.revenue += Number(row.revenue ?? 0);
    entry.payout += Number(row.payout ?? 0);
    merged.set(key, entry);
  }

  return merged;
}

function toReportRow(key: string, label: string, row: MergedRow): ReportRowDto {
  const profit = row.revenue - row.payout;
  return {
    key,
    label,
    clicks: row.clicks,
    uniqueClicks: row.uniqueClicks,
    blockedClicks: row.blockedClicks,
    suspectClicks: row.suspectClicks,
    conversions: row.conversions,
    approvedConversions: row.approved,
    rejectedConversions: row.rejected,
    conversionRate: rate(row.conversions, row.clicks),
    revenue: money(row.revenue),
    payout: money(row.payout),
    profit: money(profit),
    epc: perUnit(row.payout, row.clicks),
    margin: rate(profit, row.revenue),
  };
}

// Totals are summed from the same rows the table renders, so a tile can never
// disagree with the column beneath it.
function totalsOf(rows: ReportRowDto[]): ReportTotalsDto {
  const sum = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      uniqueClicks: acc.uniqueClicks + row.uniqueClicks,
      blockedClicks: acc.blockedClicks + row.blockedClicks,
      suspectClicks: acc.suspectClicks + row.suspectClicks,
      conversions: acc.conversions + row.conversions,
      approvedConversions: acc.approvedConversions + row.approvedConversions,
      rejectedConversions: acc.rejectedConversions + row.rejectedConversions,
      revenue: acc.revenue + row.revenue,
      payout: acc.payout + row.payout,
    }),
    {
      clicks: 0,
      uniqueClicks: 0,
      blockedClicks: 0,
      suspectClicks: 0,
      conversions: 0,
      approvedConversions: 0,
      rejectedConversions: 0,
      revenue: 0,
      payout: 0,
    },
  );

  const profit = sum.revenue - sum.payout;
  return {
    clicks: sum.clicks,
    uniqueClicks: sum.uniqueClicks,
    blockedClicks: sum.blockedClicks,
    suspectClicks: sum.suspectClicks,
    conversions: sum.conversions,
    approvedConversions: sum.approvedConversions,
    rejectedConversions: sum.rejectedConversions,
    conversionRate: rate(sum.conversions, sum.clicks),
    revenue: money(sum.revenue),
    payout: money(sum.payout),
    profit: money(profit),
    epc: perUnit(sum.payout, sum.clicks),
    margin: rate(profit, sum.revenue),
  };
}

// Narrows an admin row to the affiliate-visible subset. Written as an explicit field
// list rather than a destructured rest, so adding a money field to ReportRowDto can
// never silently carry it through to the affiliate portal.
function toAffiliateReportRow(row: ReportRowDto): AffiliateReportRowDto {
  return {
    key: row.key,
    label: row.label,
    clicks: row.clicks,
    uniqueClicks: row.uniqueClicks,
    conversions: row.conversions,
    approvedConversions: row.approvedConversions,
    rejectedConversions: row.rejectedConversions,
    conversionRate: row.conversionRate,
    payout: row.payout,
    epc: row.epc,
  };
}

function affiliateTotalsOf(rows: AffiliateReportRowDto[]): AffiliateReportTotalsDto {
  const sum = rows.reduce(
    (acc, row) => ({
      clicks: acc.clicks + row.clicks,
      uniqueClicks: acc.uniqueClicks + row.uniqueClicks,
      conversions: acc.conversions + row.conversions,
      approvedConversions: acc.approvedConversions + row.approvedConversions,
      rejectedConversions: acc.rejectedConversions + row.rejectedConversions,
      payout: acc.payout + row.payout,
    }),
    { clicks: 0, uniqueClicks: 0, conversions: 0, approvedConversions: 0, rejectedConversions: 0, payout: 0 },
  );

  return {
    clicks: sum.clicks,
    uniqueClicks: sum.uniqueClicks,
    conversions: sum.conversions,
    approvedConversions: sum.approvedConversions,
    rejectedConversions: sum.rejectedConversions,
    conversionRate: rate(sum.conversions, sum.clicks),
    payout: money(sum.payout),
    epc: perUnit(sum.payout, sum.clicks),
  };
}

// Date rows read chronologically (a trend chart); every other dimension is a ranking,
// so it reads by volume with the biggest contributor first.
function sortRows(dimension: ReportDimension, rows: ReportRowDto[]): ReportRowDto[] {
  if (dimension === 'date') {
    return rows.sort((a, b) => a.key.localeCompare(b.key));
  }
  return rows.sort((a, b) => b.clicks - a.clicks || b.conversions - a.conversions);
}

export const reportService = {
  async getGroupedReport(dto: GroupedReportDto): Promise<GroupedReportResultDto> {
    const { groupBy, limit, ...filters } = dto;
    const merged = await mergeAggregates(groupBy, filters);
    const labels = await labelsFor(groupBy, [...merged.keys()]);

    const rows = sortRows(
      groupBy,
      [...merged.entries()].map(([key, row]) => toReportRow(key, labels.get(key) ?? key, row)),
    );

    // Totals are computed before the limit is applied — a footer that only summed the
    // visible rows would understate the real figures.
    const totals = totalsOf(rows);

    return { groupBy, rows: rows.slice(0, limit), totals };
  },

  /**
   * CR Optimizer — rows whose recent conversion rate has moved sharply against their
   * own trailing baseline.
   *
   * Each row is compared only to itself, because a "good" CR is entirely vertical- and
   * geo-dependent; a fixed cross-network threshold would flag every low-CR vertical and
   * miss a real collapse in a high-CR one. Rows below `minClicks` in either window are
   * dropped — a 1-click sample produces a 0% or 100% CR and nothing in between.
   */
  async getCrOptimizer(dimension: 'offer' | 'affiliate', dto: CrOptimizerDto): Promise<CrAnomalyDto[]> {
    const now = new Date();
    const recentStart = new Date(now);
    recentStart.setDate(recentStart.getDate() - dto.recentDays);
    const baselineStart = new Date(recentStart);
    baselineStart.setDate(baselineStart.getDate() - dto.baselineDays);

    const [recent, baseline] = await Promise.all([
      mergeAggregates(dimension, { dateFrom: recentStart.toISOString(), dateTo: now.toISOString() }),
      mergeAggregates(dimension, { dateFrom: baselineStart.toISOString(), dateTo: recentStart.toISOString() }),
    ]);

    const keys = [...new Set([...recent.keys(), ...baseline.keys()])];
    const labels = await labelsFor(dimension, keys);

    return keys
      .map((key) => {
        const recentRow = recent.get(key) ?? emptyRow();
        const baselineRow = baseline.get(key) ?? emptyRow();
        const recentCr = rate(recentRow.conversions, recentRow.clicks);
        const baselineCr = rate(baselineRow.conversions, baselineRow.clicks);

        // Relative change against the baseline. With no baseline CR there is nothing
        // to compare against, so the row is reported as stable rather than as an
        // infinite spike.
        const deltaPercent = baselineCr === 0 ? 0 : Number((((recentCr - baselineCr) / baselineCr) * 100).toFixed(2));

        let verdict: CrAnomalyDto['verdict'] = 'STABLE';
        if (baselineCr > 0 && deltaPercent <= -25) verdict = 'DROPPED';
        else if (baselineCr > 0 && deltaPercent >= 50) verdict = 'SPIKED';

        return {
          key,
          label: labels.get(key) ?? key,
          recentClicks: recentRow.clicks,
          recentConversions: recentRow.conversions,
          recentCr,
          baselineClicks: baselineRow.clicks,
          baselineConversions: baselineRow.conversions,
          baselineCr,
          deltaPercent,
          verdict,
        };
      })
      .filter((row) => row.key !== UNKNOWN_KEY && row.recentClicks >= dto.minClicks && row.baselineClicks >= dto.minClicks)
      // Biggest movement first, in either direction — a spike is as much a signal
      // (possible fraud) as a drop is.
      .sort((a, b) => Math.abs(b.deltaPercent) - Math.abs(a.deltaPercent));
  },

  /**
   * Affiliate × Offer cross-tab.
   *
   * Built by running the per-affiliate report once per offer rather than adding a
   * two-column GROUP BY to the repository: the offer list is bounded and small, the
   * pair-space is what the page actually renders, and it reuses the same merge path
   * every other report is verified against.
   */
  async getAffiliateOfferCr(filters: ReportFiltersDto, limit = 200): Promise<AffiliateOfferCrDto[]> {
    const offerReport = await mergeAggregates('offer', filters);
    const offerIds = [...offerReport.keys()].filter((key) => key !== UNKNOWN_KEY);
    const offers = await offerNames(offerIds);

    const pairs: AffiliateOfferCrDto[] = [];

    for (const offerId of offerIds) {
      const byAffiliate = await mergeAggregates('affiliate', { ...filters, offerId });
      const affiliateIds = [...byAffiliate.keys()].filter((key) => key !== UNKNOWN_KEY);
      const affiliates = await affiliateNames(affiliateIds);

      for (const affiliateId of affiliateIds) {
        const row = byAffiliate.get(affiliateId)!;
        pairs.push({
          affiliateId,
          affiliateName: affiliates.get(affiliateId) ?? affiliateId,
          offerId,
          offerName: offers.get(offerId) ?? offerId,
          clicks: row.clicks,
          conversions: row.conversions,
          conversionRate: rate(row.conversions, row.clicks),
          payout: money(row.payout),
          epc: perUnit(row.payout, row.clicks),
        });
      }
    }

    return pairs.sort((a, b) => b.conversions - a.conversions || b.clicks - a.clicks).slice(0, limit);
  },

  // Shared by the dashboard's trend chart and the Performance report.
  async getTrend(filters: ReportFiltersDto): Promise<ReportRowDto[]> {
    const merged = await mergeAggregates('date', filters);
    return sortRows(
      'date',
      [...merged.entries()].map(([key, row]) => toReportRow(key, key, row)),
    );
  },

  /**
   * Top-N rows for a dimension.
   *
   * `sortBy` names the metric the caller is actually ranking on. A "top affiliates by
   * payout" list ordered by clicks would put a lower-earning affiliate above a
   * higher-earning one under a heading that promises otherwise, so the caller states
   * the metric rather than inheriting the default click ordering.
   */
  async getTopRows(
    dimension: ReportDimension,
    filters: ReportFiltersDto,
    limit: number,
    sortBy: keyof Pick<ReportRowDto, 'clicks' | 'conversions' | 'revenue' | 'payout' | 'profit'> = 'clicks',
  ): Promise<ReportRowDto[]> {
    const merged = await mergeAggregates(dimension, filters);
    const labels = await labelsFor(dimension, [...merged.keys()]);
    const rows = [...merged.entries()].map(([key, row]) => toReportRow(key, labels.get(key) ?? key, row));
    return rows.sort((a, b) => b[sortBy] - a[sortBy]).slice(0, limit);
  },

  /**
   * Affiliate-facing grouped report.
   *
   * `affiliateId` is a separate argument rather than part of the filter object so the
   * caller cannot omit it: this must always be scoped to the signed-in affiliate,
   * resolved from the JWT, never from a client-supplied filter. The rows come back as
   * AffiliateReportRowDto, which has no revenue/profit/margin fields at all.
   */
  async getAffiliateGroupedReport(
    affiliateId: string,
    dto: AffiliateGroupedReportDto,
  ): Promise<AffiliateGroupedReportResultDto> {
    const { groupBy, limit, ...filters } = dto;
    const merged = await mergeAggregates(groupBy, { ...filters, affiliateId });
    const labels = await labelsFor(groupBy, [...merged.keys()]);

    const rows = sortRows(
      groupBy,
      [...merged.entries()].map(([key, row]) => toReportRow(key, labels.get(key) ?? key, row)),
    ).map(toAffiliateReportRow);

    return { groupBy, rows: rows.slice(0, limit), totals: affiliateTotalsOf(rows) };
  },

  async getAffiliateTrend(affiliateId: string, filters: ReportFiltersDto): Promise<AffiliateReportRowDto[]> {
    const merged = await mergeAggregates('date', { ...filters, affiliateId });
    return sortRows(
      'date',
      [...merged.entries()].map(([key, row]) => toReportRow(key, key, row)),
    ).map(toAffiliateReportRow);
  },

  async getAffiliateTopRows(
    dimension: ReportDimension,
    affiliateId: string,
    filters: ReportFiltersDto,
    limit: number,
  ): Promise<AffiliateReportRowDto[]> {
    const rows = await this.getTopRows(dimension, { ...filters, affiliateId }, limit, 'payout');
    return rows.map(toAffiliateReportRow);
  },
};

export { totalsOf, mergeAggregates, toReportRow, UNKNOWN_KEY };
