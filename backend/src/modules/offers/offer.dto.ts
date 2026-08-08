import { z } from 'zod';
import { env } from '../../common/env';
import { OfferStatus, TrackingPlatform, type Offer } from './offer.entity';
import { PayoutMode, PayoutType, RevenueModel, type PayoutRule } from './payout-rule.entity';
import { CapMetric, CapPeriod, type OfferCap } from './offer-cap.entity';

const targetingSchema = z.object({
  countries: z.array(z.string()),
  devices: z.array(z.string()),
  affiliateIds: z.array(z.string()),
  affiliateGroupIds: z.array(z.string()),
});

const holdScheduleSchema = z.object({
  enabled: z.boolean(),
  days: z.number().int().nonnegative(),
});

export const payoutRuleInputSchema = z.object({
  payoutMode: z.nativeEnum(PayoutMode),
  payoutType: z.nativeEnum(PayoutType),
  amount: z.coerce.number().nonnegative(),
  revenueModel: z.nativeEnum(RevenueModel),
  revenueAmount: z.coerce.number().nonnegative(),
  targeting: targetingSchema,
  managerCommissionPercent: z.number().int().min(0).max(100),
  referAffiliateCommissionPercent: z.number().int().min(0).max(100),
  holdSchedule: holdScheduleSchema,
  commissionPercent: z.number().int().min(0).max(100),
});

export type PayoutRuleInputDto = z.infer<typeof payoutRuleInputSchema>;

export const offerCapInputSchema = z.object({
  period: z.nativeEnum(CapPeriod),
  metric: z.nativeEnum(CapMetric),
  limit: z.coerce.number().nonnegative(),
});

export type OfferCapInputDto = z.infer<typeof offerCapInputSchema>;

export const offerFiltersSchema = z.object({
  advertiserId: z.string().uuid().optional(),
  status: z.nativeEnum(OfferStatus).optional(),
  category: z.string().optional(),
  trafficType: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type OfferFiltersDto = z.infer<typeof offerFiltersSchema>;

// destinationUrl/postbackSecret/allowedPostbackIps are optional — an offer can be
// created before they're configured and set before its first APPROVED transition
// (see the activation gate in offer.service.ts).
export const createOfferSchema = z.object({
  advertiserId: z.string().uuid(),
  name: z.string().min(1),
  previewLink: z.string().url().optional(),
  description: z.string().optional(),
  kpi: z.string().optional(),
  category: z.string().optional(),
  iconUrl: z.string().url().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  currency: z.string().min(1),
  trackingPlatform: z.nativeEnum(TrackingPlatform),
  trafficTypes: z.array(z.string()),
  featured: z.boolean(),
  networkOfferId: z.string().optional(),
  autoApproveConversions: z.boolean(),
  allowDeepLinking: z.boolean(),
  remarksForAdmin: z.string().optional(),
  remarksForAffiliateManager: z.string().optional(),
  payoutRules: z.array(payoutRuleInputSchema),
  caps: z.array(offerCapInputSchema),
  defaultPayoutAmount: z.coerce.number().nonnegative(),
  destinationUrl: z.string().optional(),
  postbackSecret: z.string().optional(),
  allowedPostbackIps: z.string().optional(),
  // Per-offer override for where BLOCKED traffic goes; blank uses the network setting.
  blockedRedirectUrl: z.union([z.string().trim().url().max(500), z.literal('')]).optional(),
});

export type CreateOfferDto = z.infer<typeof createOfferSchema>;

export const updateOfferSchema = createOfferSchema;

export type UpdateOfferDto = z.infer<typeof updateOfferSchema>;

export const updateOfferStatusSchema = z.object({
  status: z.nativeEnum(OfferStatus),
});

export type UpdateOfferStatusDto = z.infer<typeof updateOfferStatusSchema>;

export interface PayoutRuleDto {
  id: string;
  offerId: string;
  payoutMode: PayoutMode;
  payoutType: PayoutType;
  amount: number;
  revenueModel: RevenueModel;
  revenueAmount: number;
  targeting: PayoutRule['targeting'];
  managerCommissionPercent: number;
  referAffiliateCommissionPercent: number;
  holdSchedule: { enabled: boolean; days: number };
  commissionPercent: number;
}

export function toPayoutRuleDto(rule: PayoutRule): PayoutRuleDto {
  return {
    id: rule.id,
    offerId: rule.offerId,
    payoutMode: rule.payoutMode,
    payoutType: rule.payoutType,
    amount: Number(rule.amount),
    revenueModel: rule.revenueModel,
    revenueAmount: Number(rule.revenueAmount),
    targeting: rule.targeting,
    managerCommissionPercent: rule.managerCommissionPercent,
    referAffiliateCommissionPercent: rule.referAffiliateCommissionPercent,
    holdSchedule: { enabled: rule.holdEnabled, days: rule.holdDays },
    commissionPercent: rule.commissionPercent,
  };
}

export interface OfferCapDto {
  id: string;
  period: CapPeriod;
  metric: CapMetric;
  limit: number;
}

export function toOfferCapDto(cap: OfferCap): OfferCapDto {
  return { id: cap.id, period: cap.period, metric: cap.metric, limit: Number(cap.limit) };
}

export interface OfferDto {
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
  payoutRules: PayoutRuleDto[];
  caps: OfferCapDto[];
  createdAt: string;
  defaultPayoutAmount: number;
  destinationUrl: string | null;
  postbackSecret: string | null;
  allowedPostbackIps: string | null;
  // Computed, not stored — null until postbackSecret is set, since the secret is part
  // of the URL. Never appears on AffiliateOfferDto; it's the credential that lets
  // someone create conversions, not something to hand to a traffic source.
  postbackUrl: string | null;
  postbackVerifiedAt: string | null;
  blockedRedirectUrl: string | null;
}

/**
 * Affiliate-facing payout rule.
 *
 * Its own type rather than a zeroed PayoutRuleDto: `revenueModel`, `revenueAmount`
 * and the internal commission splits have no field here at all, so they cannot be
 * reintroduced by someone later editing the admin DTO. Targeting is narrowed to
 * countries and devices — an affiliate needs to know where they may run traffic, but
 * which other affiliates or groups an offer targets is network-commercial detail.
 */
export interface AffiliatePayoutRuleDto {
  id: string;
  offerId: string;
  payoutMode: PayoutMode;
  payoutType: PayoutType;
  amount: number;
  countries: string[];
  devices: string[];
  holdSchedule: { enabled: boolean; days: number };
}

function toAffiliatePayoutRuleDto(rule: PayoutRule): AffiliatePayoutRuleDto {
  return {
    id: rule.id,
    offerId: rule.offerId,
    payoutMode: rule.payoutMode,
    payoutType: rule.payoutType,
    amount: Number(rule.amount),
    countries: rule.targeting?.countries ?? [],
    devices: rule.targeting?.devices ?? [],
    holdSchedule: { enabled: rule.holdEnabled, days: rule.holdDays },
  };
}

// Affiliate-facing projection of an offer — payout-only (money-visibility rule, see
// PLAN.md/PLAN-affiliate-portal.md). Revenue and internal commission splits have no
// field on this shape, and operational/advertiser-cost fields (postbackSecret,
// destinationUrl, allowedPostbackIps, defaultPayoutAmount, remarksForAdmin) are
// dropped entirely. `advertiserName` is denormalized so the affiliate portal never
// needs an admin-only /advertisers call.
export interface AffiliateOfferDto {
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
  payoutRules: AffiliatePayoutRuleDto[];
  caps: OfferCapDto[];
  createdAt: string;
}

// The admin view has no single affiliate to attribute to, so it keeps the
// {affiliate_id} macro — an admin copying this link would be copying a template.
function trackingLinkFor(offerId: string): string {
  return `${env.PUBLIC_TRACKING_URL}/click?offerId=${offerId}&affiliateId={affiliate_id}`;
}

// The affiliate view substitutes the caller's own id, resolved from their JWT — so
// the link they copy actually works. The id is never taken from the request.
// Exported for the email triggers (access-request approved, offer-live) that need
// the same working link outside this DTO's own render path.
export function affiliateTrackingLinkFor(offerId: string, affiliateId: string): string {
  return `${env.PUBLIC_TRACKING_URL}/click?offerId=${offerId}&affiliateId=${affiliateId}`;
}

// What the admin copies and hands to the advertiser to paste into their own tracking
// platform's conversion-postback setting. {click_id} stays a macro — the advertiser's
// platform substitutes it per conversion, the same way ours substitutes it into
// destinationUrl per click.
function postbackUrlFor(offerId: string, postbackSecret: string | null): string | null {
  if (!postbackSecret) return null;
  return `${env.PUBLIC_TRACKING_URL}/postback?offerId=${offerId}&click_id={click_id}&secret=${postbackSecret}`;
}

export function toAffiliateOfferDto(offer: Offer, affiliateId?: string): AffiliateOfferDto {
  return {
    id: offer.id,
    advertiserId: offer.advertiserId,
    advertiserName: offer.advertiser?.name ?? null,
    name: offer.name,
    previewLink: offer.previewLink ?? undefined,
    description: offer.description ?? undefined,
    kpi: offer.kpi ?? undefined,
    category: offer.category ?? undefined,
    iconUrl: offer.iconUrl ?? undefined,
    startDate: offer.startDate?.toISOString(),
    endDate: offer.endDate?.toISOString(),
    currency: offer.currency,
    status: offer.status,
    trackingLink: affiliateId ? affiliateTrackingLinkFor(offer.id, affiliateId) : trackingLinkFor(offer.id),
    trackingPlatform: offer.trackingPlatform,
    trafficTypes: offer.trafficTypes,
    featured: offer.featured,
    networkOfferId: offer.networkOfferId ?? undefined,
    autoApproveConversions: offer.autoApproveConversions,
    allowDeepLinking: offer.allowDeepLinking,
    remarksForAffiliateManager: offer.remarksForAffiliateManager ?? undefined,
    payoutRules: offer.payoutRules.map(toAffiliatePayoutRuleDto),
    caps: offer.caps.map(toOfferCapDto),
    createdAt: offer.createdAt.toISOString(),
  };
}

export function toOfferDto(offer: Offer): OfferDto {
  return {
    id: offer.id,
    advertiserId: offer.advertiserId,
    name: offer.name,
    previewLink: offer.previewLink ?? undefined,
    description: offer.description ?? undefined,
    kpi: offer.kpi ?? undefined,
    category: offer.category ?? undefined,
    iconUrl: offer.iconUrl ?? undefined,
    startDate: offer.startDate?.toISOString(),
    endDate: offer.endDate?.toISOString(),
    currency: offer.currency,
    status: offer.status,
    trackingLink: trackingLinkFor(offer.id),
    trackingPlatform: offer.trackingPlatform,
    trafficTypes: offer.trafficTypes,
    featured: offer.featured,
    networkOfferId: offer.networkOfferId ?? undefined,
    autoApproveConversions: offer.autoApproveConversions,
    allowDeepLinking: offer.allowDeepLinking,
    remarksForAdmin: offer.remarksForAdmin ?? undefined,
    remarksForAffiliateManager: offer.remarksForAffiliateManager ?? undefined,
    payoutRules: offer.payoutRules.map(toPayoutRuleDto),
    caps: offer.caps.map(toOfferCapDto),
    createdAt: offer.createdAt.toISOString(),
    defaultPayoutAmount: Number(offer.defaultPayoutAmount),
    destinationUrl: offer.destinationUrl,
    postbackSecret: offer.postbackSecret,
    allowedPostbackIps: offer.allowedPostbackIps,
    postbackUrl: postbackUrlFor(offer.id, offer.postbackSecret),
    postbackVerifiedAt: offer.postbackVerifiedAt?.toISOString() ?? null,
    blockedRedirectUrl: offer.blockedRedirectUrl,
  };
}
