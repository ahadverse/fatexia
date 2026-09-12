import { z } from 'zod';
import { managerScopeField } from '../../common/manager-scope-sql';

// Every report shares one filter shape — PLAN-admin.md's guidance to build this as a
// single reporting module with shared filters rather than 13 one-off endpoints.
export const reportFiltersSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  offerId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  advertiserId: z.string().uuid().optional(),
  countryCode: z.string().max(2).optional(),
  // Server-set, never trusted from the query string — the controller overwrites it
  // from the session on every request (issue #5). See common/manager-scope-sql.ts.
  ...managerScopeField,
});

export type ReportFiltersDto = z.infer<typeof reportFiltersSchema>;

// Which column the rows are grouped by. `date` powers the trend chart; the rest power
// the per-entity report tables.
export const REPORT_DIMENSIONS = [
  'date',
  'offer',
  'affiliate',
  'advertiser',
  'country',
  'city',
  'device',
  'os',
  'browser',
  'subId1',
  'subId2',
  'subId3',
  'subId4',
  'subId5',
  'subId6',
  'subId7',
  'subId8',
] as const;

export type ReportDimension = (typeof REPORT_DIMENSIONS)[number];

export const groupedReportSchema = reportFiltersSchema.extend({
  groupBy: z.enum(REPORT_DIMENSIONS).default('date'),
  // Raised from 100: grouping by city or a sub-id produces far more groups than
  // grouping by offer, and the UI now warns when a result is truncated at the cap.
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

export type GroupedReportDto = z.infer<typeof groupedReportSchema>;

/**
 * One aggregated row. Every metric here is derived from clicks/conversions at query
 * time — nothing is read from a stored rollup that could drift.
 *
 * `conversionRate` is conversions/clicks, `epc` is payout per click (what the
 * affiliate earns), and `profit` is revenue − payout (what the network keeps).
 */
export interface ReportRowDto {
  key: string;
  label: string;
  clicks: number;
  uniqueClicks: number;
  // Admin-only quality breakdown. Deliberately absent from AffiliateReportRowDto —
  // how much of an affiliate's traffic each fraud band caught is network reasoning.
  blockedClicks: number;
  suspectClicks: number;
  conversions: number;
  approvedConversions: number;
  rejectedConversions: number;
  conversionRate: number;
  revenue: number;
  payout: number;
  profit: number;
  epc: number;
  margin: number;
}

export interface ReportTotalsDto {
  clicks: number;
  // Summed from the same per-row figures the table shows, so the tile and the column
  // can never disagree. Both count `clicks.isUnique`.
  uniqueClicks: number;
  conversions: number;
  approvedConversions: number;
  rejectedConversions: number;
  conversionRate: number;
  revenue: number;
  payout: number;
  profit: number;
  epc: number;
  margin: number;
  // Already computed by the aggregate query; previously selected and discarded.
  blockedClicks: number;
  suspectClicks: number;
}

export interface GroupedReportResultDto {
  groupBy: ReportDimension;
  rows: ReportRowDto[];
  totals: ReportTotalsDto;
}

// CR Optimizer: an offer/affiliate whose conversion rate has moved sharply against
// its own trailing baseline. Not a fixed CR threshold — a 2% CR is healthy in one
// vertical and broken in another, so each row is compared only to itself.
export interface CrAnomalyDto {
  key: string;
  label: string;
  recentClicks: number;
  recentConversions: number;
  recentCr: number;
  baselineClicks: number;
  baselineConversions: number;
  baselineCr: number;
  deltaPercent: number;
  verdict: 'DROPPED' | 'SPIKED' | 'STABLE';
}

export const crOptimizerSchema = z.object({
  // Trailing comparison window: `recentDays` measured against the `baselineDays`
  // immediately before it.
  recentDays: z.coerce.number().int().min(1).max(90).default(7),
  baselineDays: z.coerce.number().int().min(1).max(180).default(28),
  // Rows with too little traffic produce meaningless percentages, so they're excluded.
  minClicks: z.coerce.number().int().min(1).max(10000).default(50),
});

export type CrOptimizerDto = z.infer<typeof crOptimizerSchema>;

// Affiliate × Offer cross-tab — which affiliates convert well on which offers.
export interface AffiliateOfferCrDto {
  affiliateId: string;
  affiliateName: string;
  offerId: string;
  offerName: string;
  clicks: number;
  conversions: number;
  conversionRate: number;
  payout: number;
  epc: number;
}

/**
 * Affiliate-facing report row.
 *
 * A structurally separate type from ReportRowDto, not a runtime-zeroed copy of it:
 * revenue, profit and margin are Admin-only data (PLAN-affiliate-portal.md's hard
 * rule), and a shape that has no field for them cannot leak them by accident when
 * someone later adds a column to the admin row.
 */
export interface AffiliateReportRowDto {
  key: string;
  label: string;
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  approvedConversions: number;
  rejectedConversions: number;
  conversionRate: number;
  payout: number;
  epc: number;
}

export interface AffiliateReportTotalsDto {
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  approvedConversions: number;
  rejectedConversions: number;
  conversionRate: number;
  payout: number;
  epc: number;
}

export interface AffiliateGroupedReportResultDto {
  groupBy: ReportDimension;
  rows: AffiliateReportRowDto[];
  totals: AffiliateReportTotalsDto;
}

// Dimensions an affiliate may group by. `advertiser` is excluded deliberately — which
// advertiser sits behind an offer is network-commercial information.
export const AFFILIATE_REPORT_DIMENSIONS = [
  'date',
  'offer',
  'country',
  'city',
  'device',
  'os',
  'browser',
  'subId1',
  'subId2',
  'subId3',
  'subId4',
  'subId5',
  'subId6',
  'subId7',
  'subId8',
] as const;

export const affiliateGroupedReportSchema = z.object({
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  offerId: z.string().uuid().optional(),
  countryCode: z.string().max(2).optional(),
  groupBy: z.enum(AFFILIATE_REPORT_DIMENSIONS).default('date'),
  limit: z.coerce.number().int().min(1).max(500).default(500),
});

export type AffiliateGroupedReportDto = z.infer<typeof affiliateGroupedReportSchema>;

export interface AffiliateDashboardDto {
  summary: {
    clicks: number;
    uniqueClicks: number;
    conversions: number;
    approvedConversions: number;
    pendingConversions: number;
    conversionRate: number;
    payout: number;
    epc: number;
    availableOffers: number;
    // Payout-eligible balance and the lifetime points total — both read-only here.
    pendingPayout: number;
    totalPoints: number;
    unreadMessages: number;
  };
  // Payout-only, matching the rest of this DTO — no revenue/profit delta exists here
  // for the same structural reason the summary has no revenue field.
  deltas: {
    clicks: number | null;
    uniqueClicks: number | null;
    conversions: number | null;
    conversionRate: number | null;
    epc: number | null;
    payout: number | null;
  };
  trend: AffiliateReportRowDto[];
  topOffers: AffiliateReportRowDto[];
  activity: ActivityEvent[];
}

export type ActivityKind = 'click' | 'conversion' | 'payout';

/** One row of the dashboard's live-activity feed — see dashboard.repository.ts. */
export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  /** Offer name for click/conversion; null for a payout, which is not offer-scoped. */
  offer: string | null;
  /** The affiliate's public identifier (AFF-xxxx), never the internal uuid. */
  affiliate: string | null;
  countryCode: string | null;
  /** Payout amount for a payout row; null for click/conversion. */
  amount: number | null;
  at: string;
}

export interface DashboardSummaryDto {
  clicks: number;
  conversions: number;
  approvedConversions: number;
  pendingConversions: number;
  conversionRate: number;
  revenue: number;
  payout: number;
  profit: number;
  epc: number;
  activeOffers: number;
  pendingOffers: number;
  activeAffiliates: number;
  pendingAffiliates: number;
  pendingAccessRequests: number;
  pendingInvoices: number;
  unreadMessages: number;
  blockedClicks: number;
  suspectClicks: number;
  activeAdvertisers: number;
  /** Invoices marked paid since the 1st of the current calendar month. */
  payoutsThisMonth: number;
}

/**
 * Percentage change vs the immediately preceding window of equal length.
 *
 * Only period-based metrics appear here. The "pending X" counts are current state,
 * not a measurement over the window, so a period-over-period delta would be
 * meaningless for them. `null` means there was no baseline to compare against — see
 * percentChange in dashboard/period-delta.ts.
 */
export interface DashboardDeltasDto {
  clicks: number | null;
  conversions: number | null;
  conversionRate: number | null;
  epc: number | null;
  revenue: number | null;
  payout: number | null;
  profit: number | null;
}

export interface DashboardDto {
  summary: DashboardSummaryDto;
  deltas: DashboardDeltasDto;
  trend: ReportRowDto[];
  topOffers: ReportRowDto[];
  topAffiliates: ReportRowDto[];
  topCountries: ReportRowDto[];
  activity: ActivityEvent[];
}
