// Clicks, conversions and postback logs — the tables the Tracker writes and the
// Admin portal reads.

export type ClickQualityStatus = 'GOOD' | 'SUSPECT' | 'BLOCKED' | 'UNSCORED';

export interface ClickLog {
  id: string;
  offerId: string;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  ip: string;
  userAgent: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  regionCode: string | null;
  /** Pre-composed "City, ST, US" / "Local network" / "Unknown", built server-side so
   *  an unresolvable address reads as information rather than as a missing value. */
  geoLabel: string;
  deviceType: string | null;
  deviceBrand: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  asn: string | null;
  isDatacenter: boolean;
  // null = the proxy check never resolved, which is not the same as a confirmed false.
  isProxyOrVpn: boolean | null;
  riskScore: number;
  /** First click for this offer from this IP within 24h — decided at write time so
   *  this and the aggregate `uniqueClicks` metric share one definition. */
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
  referer: string | null;
  createdAt: string;
}

export type ConversionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'DUPLICATE' | 'PAID' | 'CHARGEBACK';

export interface Conversion {
  id: string;
  clickId: string | null;
  offerId: string;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  revenueAmount: number;
  payoutAmount: number;
  profitAmount: number;
  currency: string;
  status: ConversionStatus;
  isDuplicate: boolean;
  isOrphan: boolean;
  leadRiskScore: number;
  ctitMs: number | null;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  countryCode: string | null;
  transactionId: string | null;
  approvedAt: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface ConversionTotals {
  count: number;
  revenue: number;
  payout: number;
  profit: number;
}

export type PostbackDirection = 'INBOUND' | 'OUTBOUND';

export interface PostbackLog {
  id: string;
  conversionId: string | null;
  offerId: string | null;
  offerName: string | null;
  affiliateId: string | null;
  affiliateName: string | null;
  direction: PostbackDirection;
  url: string | null;
  payload: Record<string, unknown>;
  responseStatus: number | null;
  success: boolean;
  errorMessage: string | null;
  attemptCount: number;
  sourceIp: string | null;
  createdAt: string;
}
