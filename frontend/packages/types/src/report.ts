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
}

export interface Dashboard {
  summary: DashboardSummary;
  trend: ReportRow[];
  topOffers: ReportRow[];
  topAffiliates: ReportRow[];
  topCountries: ReportRow[];
}
