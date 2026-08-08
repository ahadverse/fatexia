// Shapes returned by the affiliate self-service endpoints (`/…/mine`).
//
// These are structurally payout-only: there is no revenue, profit or margin field on
// any of them, mirroring the Backend's separate affiliate DTOs. That is the mechanism
// behind PLAN-affiliate-portal.md's hard rule — not a habit of remembering to hide a
// column, but a shape that has nowhere to put the number.

import type { ConversionStatus, ClickQualityStatus } from './traffic';

/** Paginated list plus the totals for the stat tiles, over the same filters. */
export interface ClickLogPage<T> {
  rows: T[];
  total: number;
  page: number;
  pageSize: number;
  summary: { clicks: number; uniqueClicks: number };
}

export interface AffiliateReportRow {
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

export interface AffiliateReportTotals {
  clicks: number;
  uniqueClicks: number;
  conversions: number;
  approvedConversions: number;
  rejectedConversions: number;
  conversionRate: number;
  payout: number;
  epc: number;
}

export interface AffiliateGroupedReport {
  groupBy: string;
  rows: AffiliateReportRow[];
  totals: AffiliateReportTotals;
}

export interface AffiliateDashboard {
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
    pendingPayout: number;
    totalPoints: number;
    unreadMessages: number;
  };
  // Payout-only, matching the rest of this type — no revenue/profit delta exists for
  // the same structural reason the summary has no revenue field.
  deltas: {
    clicks: number | null;
    uniqueClicks: number | null;
    conversions: number | null;
    conversionRate: number | null;
    epc: number | null;
    payout: number | null;
  };
  trend: AffiliateReportRow[];
  topOffers: AffiliateReportRow[];
}

export interface OwnConversion {
  id: string;
  clickId: string | null;
  offerId: string;
  offerName: string | null;
  payoutAmount: number;
  currency: string;
  status: ConversionStatus;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  countryCode: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

/**
 * Narrower than the admin click row.
 *
 * IP, user agent, geo and device detail *are* included — that is the affiliate's own
 * traffic and they need it to debug a source. What stays out is the network's fraud
 * *reasoning*: `asn`, `isDatacenter`, `isProxyOrVpn`, `riskScore` and `referer`. There
 * is no field here for any of them, so a future edit to the admin row cannot leak one.
 * The quality band is kept — an affiliate must know traffic was rejected, just not
 * precisely which signal caught it.
 */
export interface OwnClickLog {
  id: string;
  offerId: string;
  offerName: string | null;
  ip: string;
  userAgent: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  regionCode: string | null;
  /** Pre-composed "City, ST, US" / "Local network" / "Unknown", built server-side. */
  geoLabel: string;
  deviceType: string | null;
  deviceBrand: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  isUnique: boolean;
  qualityStatus: ClickQualityStatus;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  subId5: string | null;
  subId6: string | null;
  subId7: string | null;
  subId8: string | null;
  createdAt: string;
}

export interface OwnBalance {
  affiliateId: string;
  eligibleAmount: number;
  eligibleConversions: number;
  meetsThreshold: boolean;
}

export interface OwnReferral {
  id: string;
  fullName: string | null;
  country: string | null;
  status: string;
  createdAt: string;
}
