export type ReportDimension =
  | 'date'
  | 'offer'
  | 'affiliate'
  | 'advertiser'
  | 'country'
  | 'city'
  | 'device'
  | 'os'
  | 'browser'
  | 'subId1'
  | 'subId2'
  | 'subId3'
  | 'subId4'
  | 'subId5'
  | 'subId6'
  | 'subId7'
  | 'subId8';

export interface ReportFilters {
  dateFrom?: string;
  dateTo?: string;
  offerId?: string;
  affiliateId?: string;
  advertiserId?: string;
  countryCode?: string;
}

export interface ReportRow {
  key: string;
  label: string;
  clicks: number;
  uniqueClicks: number;
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

export interface ReportTotals {
  clicks: number;
  uniqueClicks: number;
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

export interface GroupedReport {
  groupBy: ReportDimension;
  rows: ReportRow[];
  // Computed over every matching row, not just the returned page.
  totals: ReportTotals;
}

export type CrVerdict = 'DROPPED' | 'SPIKED' | 'STABLE';

export interface CrAnomaly {
  key: string;
  label: string;
  recentClicks: number;
  recentConversions: number;
  recentCr: number;
  baselineClicks: number;
  baselineConversions: number;
  baselineCr: number;
  deltaPercent: number;
  verdict: CrVerdict;
}

export interface AffiliateOfferCr {
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

export interface DashboardSummary {
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

export type ActivityKind = 'click' | 'conversion' | 'payout';

/**
 * One row of the live-activity feed. Deliberately not filtered by the dashboard's
 * date range — it answers "what is happening now", not "what happened in the window".
 */
export interface ActivityEvent {
  id: string;
  kind: ActivityKind;
  /** Offer name for click/conversion; null for a payout, which is not offer-scoped. */
  offer: string | null;
  /** The affiliate's public id (AFF-xxxx). Always null on the affiliate's own feed. */
  affiliate: string | null;
  countryCode: string | null;
  /** Payout amount for a payout row; null for click/conversion. */
  amount: number | null;
  at: string;
}

/**
 * Percent change vs the immediately preceding window of equal length. `null` means
 * there was no baseline (the previous period was zero), and the UI renders no
 * indicator at all rather than an invented "+100%".
 */
export interface DashboardDeltas {
  clicks: number | null;
  conversions: number | null;
  conversionRate: number | null;
  epc: number | null;
  revenue: number | null;
  payout: number | null;
  profit: number | null;
}

export interface Dashboard {
  summary: DashboardSummary;
  deltas: DashboardDeltas;
  trend: ReportRow[];
  topOffers: ReportRow[];
  topAffiliates: ReportRow[];
  topCountries: ReportRow[];
  activity: ActivityEvent[];
}
