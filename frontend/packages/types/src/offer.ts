export type OfferStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DELETED';
export type TrackingPlatform = 'DIRECT' | 'AFFISE' | 'HASOFFERS' | 'CAKE' | 'OTHER';
export type PayoutMode = 'CPA' | 'CPC' | 'CPL' | 'CPI' | 'CPS';
export type PayoutType = 'FLAT' | 'PERCENTAGE';
export type RevenueModel = 'RPA' | 'RPC' | 'RPS' | 'NONE';
export type CapPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'OVERALL';
export type CapMetric = 'CLICKS' | 'CONVERSIONS' | 'PAYOUT';

export interface PayoutRuleTargeting {
  countries: string[];
  devices: string[];
  os: string[];
  affiliateIds: string[];
  affiliateGroupIds: string[];
}

export interface PayoutRule {
  id: string;
  offerId: string;
  payoutMode: PayoutMode;
  payoutType: PayoutType;
  amount: number;
  revenueModel: RevenueModel;
  revenueAmount: number;
  targeting: PayoutRuleTargeting;
  managerCommissionPercent: number;
  referAffiliateCommissionPercent: number;
  holdSchedule: { enabled: boolean; days: number };
  commissionPercent: number;
}

export interface OfferCap {
  id: string;
  period: CapPeriod;
  metric: CapMetric;
  limit: number;
}

export interface Offer {
  id: string;
  /** The short number the offer is known by — what links and messages quote. */
  refId: number;
  advertiserId: string;
  name: string;
  previewLink?: string;
  description?: string;
  kpi?: string;
  category?: string;
  iconUrl?: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  status: OfferStatus;
  trackingLink: string;
  trackingPlatform: TrackingPlatform;
  isPublic: boolean;
  trafficTypes: string[];
  /** Sources the affiliate may NOT send. A source in neither list is unspecified. */
  disallowedTrafficTypes: string[];
  featured: boolean;
  networkOfferId?: string;
  autoApproveConversions: boolean;
  allowDeepLinking: boolean;
  remarksForAdmin?: string;
  remarksForAffiliateManager?: string;
  payoutRules: PayoutRule[];
  caps: OfferCap[];
  createdAt: string;
  defaultPayoutAmount: number;
  displayPayoutAmount: number;
  destinationUrl: string | null;
  fallbackUrl: string | null;
  postbackSecret: string | null;
  allowedPostbackIps: string | null;
  postbackUrl: string | null;
  postbackVerifiedAt: string | null;
  blockedRedirectUrl: string | null;
}

export interface PayoutRuleInput {
  payoutMode: PayoutMode;
  payoutType: PayoutType;
  amount: number;
  revenueModel: RevenueModel;
  revenueAmount: number;
  targeting: PayoutRuleTargeting;
  managerCommissionPercent: number;
  referAffiliateCommissionPercent: number;
  holdSchedule: { enabled: boolean; days: number };
  commissionPercent: number;
}

export interface OfferCapInput {
  period: CapPeriod;
  metric: CapMetric;
  limit: number;
}

export interface CreateOfferInput {
  advertiserId: string;
  name: string;
  previewLink?: string;
  description?: string;
  kpi?: string;
  category?: string;
  iconUrl?: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  trackingPlatform: TrackingPlatform;
  isPublic: boolean;
  trafficTypes: string[];
  /** Sources the affiliate may NOT send. A source in neither list is unspecified. */
  disallowedTrafficTypes: string[];
  featured: boolean;
  networkOfferId?: string;
  autoApproveConversions: boolean;
  allowDeepLinking: boolean;
  remarksForAdmin?: string;
  remarksForAffiliateManager?: string;
  payoutRules: PayoutRuleInput[];
  caps: OfferCapInput[];
  defaultPayoutAmount: number;
  destinationUrl?: string;
  fallbackUrl?: string;
  postbackSecret?: string;
  allowedPostbackIps?: string;
  blockedRedirectUrl?: string;
}

export interface OfferCategory {
  id: string;
  name: string;
}

// Affiliate-facing payout rule. Mirrors the Backend's AffiliatePayoutRuleDto: revenue
// and the internal commission splits have no field on this shape at all, and
// targeting is narrowed to the geo/device restrictions an affiliate needs in order to
// run traffic legally. Never widen this without widening the server DTO first.
export interface AffiliatePayoutRule {
  id: string;
  offerId: string;
  payoutMode: PayoutMode;
  payoutType: PayoutType;
  amount: number;
  countries: string[];
  devices: string[];
  os: string[];
  holdSchedule: { enabled: boolean; days: number };
}

// Mirrors the Backend's AffiliateOfferDto (see backend/src/modules/offers/offer.dto.ts)
// — the affiliate-facing projection of Offer returned by GET /offers/available.
// Operational fields (destinationUrl, postbackSecret, allowedPostbackIps,
// defaultPayoutAmount, remarksForAdmin) are dropped entirely — never add them back
// here without adding them back server-side first. `trackingLink` arrives with the
// caller's own affiliate id already substituted, so it is usable as-is.
/**
 * Whether the affiliate may run an offer, and if not, how far along asking is.
 * GRANTED = public, dedicated to them, or their request was approved.
 */
export type OfferAccess = 'GRANTED' | 'PENDING' | 'REJECTED' | 'LOCKED';

export interface AffiliateOffer {
  id: string;
  /** The short number the offer is known by — what links and messages quote. */
  refId: number;
  advertiserId: string;
  advertiserName: string | null;
  name: string;
  access: OfferAccess;
  previewLink?: string;
  description?: string;
  kpi?: string;
  category?: string;
  iconUrl?: string;
  startDate?: string;
  endDate?: string;
  currency: string;
  status: OfferStatus;
  /** Null unless access is GRANTED — the link is the permission to send traffic. */
  trackingLink: string | null;
  /**
   * Network-wide conversion rate and payout-per-click over the last 30 days — everyone's
   * traffic, not the caller's, which is what makes them useful for an offer they have
   * never run. Null when the offer took no clicks in the window, so the UI shows "no
   * data" rather than a 0% that reads as "does not convert".
   */
  conversionRate: number | null;
  epc: number | null;
  /** This affiliate's own bookmark. A shortlist marker; it grants nothing. */
  favourite: boolean;
  trackingPlatform: TrackingPlatform;
  trafficTypes: string[];
  /** Sources the affiliate may NOT send. A source in neither list is unspecified. */
  disallowedTrafficTypes: string[];
  featured: boolean;
  networkOfferId?: string;
  autoApproveConversions: boolean;
  allowDeepLinking: boolean;
  remarksForAffiliateManager?: string;
  payoutRules: AffiliatePayoutRule[];
  caps: OfferCap[];
  createdAt: string;
}
