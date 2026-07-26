export type OfferStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PAUSED' | 'DELETED';
export type TrackingPlatform = 'DIRECT' | 'AFFISE' | 'HASOFFERS' | 'CAKE' | 'OTHER';
export type PayoutMode = 'CPA' | 'CPC' | 'CPL' | 'CPI' | 'CPS';
export type PayoutType = 'FLAT' | 'PERCENTAGE';
export type RevenueModel = 'RPA' | 'RPC' | 'NONE';
export type CapPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'OVERALL';
export type CapMetric = 'CLICKS' | 'CONVERSIONS' | 'PAYOUT';

export interface PayoutRuleTargeting {
  countries: string[];
  devices: string[];
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
  trafficTypes: string[];
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
  destinationUrl: string | null;
  postbackSecret: string | null;
  allowedPostbackIps: string | null;
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
  trafficTypes: string[];
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
  holdSchedule: { enabled: boolean; days: number };
}

// Mirrors the Backend's AffiliateOfferDto (see backend/src/modules/offers/offer.dto.ts)
// — the affiliate-facing projection of Offer returned by GET /offers/available.
// Operational fields (destinationUrl, postbackSecret, allowedPostbackIps,
// defaultPayoutAmount, remarksForAdmin) are dropped entirely — never add them back
// here without adding them back server-side first. `trackingLink` arrives with the
// caller's own affiliate id already substituted, so it is usable as-is.
export interface AffiliateOffer {
  id: string;
  advertiserId: string;
  advertiserName: string | null;
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
  trafficTypes: string[];
  featured: boolean;
  networkOfferId?: string;
  autoApproveConversions: boolean;
  allowDeepLinking: boolean;
  remarksForAffiliateManager?: string;
  payoutRules: AffiliatePayoutRule[];
  caps: OfferCap[];
  createdAt: string;
}
