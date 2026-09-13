import { z } from 'zod';
import { env } from '../../common/env';
import { OfferStatus, TrackingPlatform, type Offer } from './offer.entity';
import { PayoutMode, PayoutType, RevenueModel, type PayoutRule } from './payout-rule.entity';
import { CapMetric, CapPeriod, type OfferCap } from './offer-cap.entity';
import { computeAmounts, pickRepresentativeRule } from './payout-resolution';

const targetingSchema = z.object({
  countries: z.array(z.string()),
  devices: z.array(z.string()),
  os: z.array(z.string()),
  affiliateIds: z.array(z.string()),
  affiliateGroupIds: z.array(z.string()),
});

const holdScheduleSchema = z.object({
  enabled: z.boolean(),
  days: z.number().int().nonnegative(),
});

export const payoutRuleInputSchema = z
  .object({
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
  })
  // Server-side backstop for the same rule OfferForm enforces in the UI: percentage
  // payout only has a meaningful base for a sale — a lead/click/install has nothing to
  // take a % of.
  .refine((rule) => rule.payoutType !== PayoutType.PERCENTAGE || rule.payoutMode === PayoutMode.CPS, {
    message: 'PERCENTAGE payout type is only valid with payoutMode CPS',
    path: ['payoutType'],
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
  isPublic: z.boolean(),
  trafficTypes: z.array(z.string()),
  disallowedTrafficTypes: z.array(z.string()).optional().default([]),
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
  // Where a click goes when it matches none of the offer's payout-rule targeting
  // (issue #15). Blank/omitted means "use destinationUrl", same as blockedRedirectUrl
  // falling back to the network default.
  fallbackUrl: z.union([z.string().trim().url().max(500), z.literal('')]).optional(),
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

// The bookmark carries its target state rather than being a bare "toggle" POST, so two
// tabs (or a retried request) converge on what the affiliate last clicked instead of
// flipping each other.
export const setOfferFavouriteSchema = z.object({
  favourite: z.boolean(),
});

export type SetOfferFavouriteDto = z.infer<typeof setOfferFavouriteSchema>;

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
  /** The short number the offer is known by — see common/ref-id.ts. */
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
  disallowedTrafficTypes: string[];
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
  // What the offer actually pays right now, per its own payout rules (issue #16) —
  // the wildcard/first rule's computed amount, not the separate defaultPayoutAmount
  // field, which is easy to leave at 0 while payoutRules is fully configured.
  displayPayoutAmount: number;
  destinationUrl: string | null;
  fallbackUrl: string | null;
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
  os: string[];
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
    os: rule.targeting?.os ?? [],
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
  /** The short number the offer is known by — what a link and a message quote. */
  refId: number;
  advertiserId: string;
  advertiserName: string | null;
  name: string;
  /** Whether this affiliate may run it — see OfferAccess and toAffiliateOfferDto. */
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
  /** Null unless access is GRANTED: the link is the permission. */
  trackingLink: string | null;
  /**
   * Network-wide conversion rate and payout-per-click over the last 30 days — not the
   * caller's own numbers, which is the point: this is how an affiliate judges an offer
   * they have never run. Null when the offer has taken no clicks in the window, so the
   * list can say "no data" instead of showing a 0% that reads as "does not convert".
   * Shown on locked offers too — the figures are what decides whether to ask.
   */
  conversionRate: number | null;
  epc: number | null;
  /** This affiliate's own bookmark. A shortlist marker; it grants nothing. */
  favourite: boolean;
  trackingPlatform: TrackingPlatform;
  trafficTypes: string[];
  disallowedTrafficTypes: string[];
  featured: boolean;
  networkOfferId?: string;
  autoApproveConversions: boolean;
  allowDeepLinking: boolean;
  remarksForAffiliateManager?: string;
  payoutRules: AffiliatePayoutRuleDto[];
  caps: OfferCapDto[];
  createdAt: string;
}

/**
 * Tracking links name their offer and affiliate by the short public id, not the uuid.
 *
 * A link is the most-copied string in the product — it goes into ad platforms, chat
 * messages, spreadsheets and other people's systems — and two 36-character uuids made
 * it unreadable and impossible to check by eye. The offer carries its `refId`; the
 * affiliate carries the `publicId` (`AFF-1001`) it already had, rather than being given
 * a second number that means the same thing.
 *
 * The tracker still accepts uuids in both positions, so every link already issued keeps
 * working — a link, once pasted into someone else's system, is not something the network
 * gets to reissue (see offerRepository.findForClick, affiliateRepository.resolveIdForClick).
 */

// The admin view has no single affiliate to attribute to, so it keeps the
// {affiliate_id} macro — an admin copying this link would be copying a template.
function trackingLinkFor(offerRefId: number): string {
  return `${env.PUBLIC_TRACKING_URL}/click?offerId=${offerRefId}&affiliateId={affiliate_id}`;
}

// The affiliate view substitutes the caller's own id, resolved from their JWT — so
// the link they copy actually works. The id is never taken from the request.
// Exported for the email triggers (access-request approved, offer-live) that need
// the same working link outside this DTO's own render path.
export function affiliateTrackingLinkFor(offerRefId: number, affiliatePublicId: string): string {
  return `${env.PUBLIC_TRACKING_URL}/click?offerId=${offerRefId}&affiliateId=${affiliatePublicId}`;
}

/**
 * What a link should call this affiliate.
 *
 * `publicId` for every affiliate that has one, which is all of them — the column is
 * nullable only because it was added to a table that already had rows, and that
 * migration backfilled them. The uuid is the fallback for a row that somehow escaped
 * both, so a missing display id degrades to a longer link rather than a broken one.
 */
export function affiliateLinkId(affiliate: { publicId: string | null; id: string }): string {
  return affiliate.publicId ?? affiliate.id;
}

// What the admin copies and hands to the advertiser to paste into their own tracking
// platform's conversion-postback setting. {click_id} stays a macro — the advertiser's
// platform substitutes it per conversion, the same way ours substitutes it into
// destinationUrl per click.
function postbackUrlFor(offerRefId: number, postbackSecret: string | null): string | null {
  if (!postbackSecret) return null;
  return `${env.PUBLIC_TRACKING_URL}/postback?offerId=${offerRefId}&click_id={click_id}&secret=${postbackSecret}`;
}

/**
 * Whether this affiliate may actually run the offer, and if not, how far along asking is.
 *
 * GRANTED covers all three routes in: the offer is public, a payout rule dedicates it to
 * them, or their access request was approved. The rest describe a gated offer they are
 * still outside of.
 */
export type OfferAccess = 'GRANTED' | 'PENDING' | 'REJECTED' | 'LOCKED';

/**
 * `access` decides what this projection is allowed to carry.
 *
 * A locked offer is browsable — it shows on the list with its payout, geo and devices so
 * the affiliate can decide whether to ask — but it must not carry the things that let
 * them act on it. `trackingLink` is null, because a link is permission: the tracker
 * takes a click at face value, so handing one out would make the approval step
 * decorative. The brief (description, KPI, manager's notes, preview link) is withheld
 * for the same reason the network gated the offer in the first place.
 */
export interface AffiliateOfferContext {
  /** The caller's own public id, substituted into the tracking link. */
  affiliateLinkId?: string;
  access: OfferAccess;
  /** From reportService.getOfferStats — absent when the offer has no traffic yet. */
  stats?: { conversionRate: number; epc: number };
  favourite: boolean;
}

export function toAffiliateOfferDto(offer: Offer, context: AffiliateOfferContext): AffiliateOfferDto {
  const { affiliateLinkId: linkId, access, stats, favourite } = context;
  const granted = access === 'GRANTED';
  return {
    id: offer.id,
    refId: offer.refId,
    advertiserId: offer.advertiserId,
    advertiserName: offer.advertiser?.name ?? null,
    name: offer.name,
    access,
    previewLink: granted ? offer.previewLink ?? undefined : undefined,
    description: granted ? offer.description ?? undefined : undefined,
    kpi: granted ? offer.kpi ?? undefined : undefined,
    category: offer.category ?? undefined,
    iconUrl: offer.iconUrl ?? undefined,
    startDate: offer.startDate?.toISOString(),
    endDate: offer.endDate?.toISOString(),
    currency: offer.currency,
    status: offer.status,
    trackingLink: granted ? (linkId ? affiliateTrackingLinkFor(offer.refId, linkId) : trackingLinkFor(offer.refId)) : null,
    conversionRate: stats?.conversionRate ?? null,
    epc: stats?.epc ?? null,
    favourite,
    trackingPlatform: offer.trackingPlatform,
    trafficTypes: offer.trafficTypes,
    disallowedTrafficTypes: offer.disallowedTrafficTypes ?? [],
    featured: offer.featured,
    networkOfferId: offer.networkOfferId ?? undefined,
    autoApproveConversions: offer.autoApproveConversions,
    allowDeepLinking: offer.allowDeepLinking,
    remarksForAffiliateManager: granted ? offer.remarksForAffiliateManager ?? undefined : undefined,
    payoutRules: offer.payoutRules.map(toAffiliatePayoutRuleDto),
    caps: offer.caps.map(toOfferCapDto),
    createdAt: offer.createdAt.toISOString(),
  };
}

export function toOfferDto(offer: Offer): OfferDto {
  const representativeRule = pickRepresentativeRule(offer.payoutRules);
  const displayPayoutAmount = representativeRule ? computeAmounts(representativeRule).payoutAmount : 0;
  return {
    id: offer.id,
    refId: offer.refId,
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
    trackingLink: trackingLinkFor(offer.refId),
    trackingPlatform: offer.trackingPlatform,
    isPublic: offer.isPublic,
    trafficTypes: offer.trafficTypes,
    disallowedTrafficTypes: offer.disallowedTrafficTypes ?? [],
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
    displayPayoutAmount,
    destinationUrl: offer.destinationUrl,
    fallbackUrl: offer.fallbackUrl,
    postbackSecret: offer.postbackSecret,
    allowedPostbackIps: offer.allowedPostbackIps,
    postbackUrl: postbackUrlFor(offer.refId, offer.postbackSecret),
    postbackVerifiedAt: offer.postbackVerifiedAt?.toISOString() ?? null,
    blockedRedirectUrl: offer.blockedRedirectUrl,
  };
}
