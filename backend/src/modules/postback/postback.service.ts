import { createHash, timingSafeEqual } from 'node:crypto';
import { NotFoundError } from '../../common/errors';
import { offerRepository } from '../offers/offer.repository';
import { Offer } from '../offers/offer.entity';
import { PayoutRule, PayoutType, type PayoutRuleTargeting } from '../offers/payout-rule.entity';
import { clickRepository } from '../clicks/click.repository';
import { Click } from '../clicks/click.entity';
import { conversionRepository } from '../conversions/conversion.repository';
import { ConversionStatus } from '../conversions/conversion.entity';
import { affiliateGroupRepository } from '../affiliate-groups/affiliate-group.repository';
import { postbackLogRepository } from '../postback-logs/postback-log.repository';
import { PostbackDirection } from '../postback-logs/postback-log.entity';

export interface PostbackRequest {
  offerId: string;
  clickId: string;
  secret: string;
  transactionId: string | null;
  sourceIp: string;
  rawQuery: Record<string, unknown>;
}

export interface PostbackResult {
  conversionId: string;
}

// Fixed-length digest comparison so a mismatched secret never leaks timing
// information proportional to how many leading characters matched.
function secretsMatch(provided: string, actual: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(actual).digest();
  return timingSafeEqual(a, b);
}

function ipAllowed(sourceIp: string, allowedPostbackIps: string): boolean {
  const allowed = allowedPostbackIps
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  return allowed.includes(sourceIp);
}

function isWildcard(t: PayoutRuleTargeting): boolean {
  return t.countries.length === 0 && t.devices.length === 0 && t.affiliateIds.length === 0 && t.affiliateGroupIds.length === 0;
}

function ruleMatchesClick(t: PayoutRuleTargeting, click: Click, affiliateGroupIds: string[]): boolean {
  if (t.countries.length > 0 && (!click.countryCode || !t.countries.includes(click.countryCode))) return false;
  if (t.devices.length > 0 && (!click.deviceType || !t.devices.includes(click.deviceType))) return false;
  if (t.affiliateIds.length > 0 && (!click.affiliateId || !t.affiliateIds.includes(click.affiliateId))) return false;
  if (t.affiliateGroupIds.length > 0 && !t.affiliateGroupIds.some((gid) => affiliateGroupIds.includes(gid))) return false;
  return true;
}

// Picks the payout rule that applies to this specific conversion. An orphan postback
// (no matching click) has nothing to target against, so it falls back to the offer's
// untargeted rule if it has one. A rule with no matching target at all still falls
// back rather than leaving the conversion unpriced — every offer requires at least
// one payout rule to exist (see OfferForm), so `rules` is never empty in practice.
async function resolvePayoutRule(offer: Offer, click: Click | null): Promise<PayoutRule | null> {
  const rules = offer.payoutRules;
  if (rules.length === 0) return null;
  if (!click) {
    return rules.find(isWildcardRule) ?? rules[0]!;
  }

  const needsGroupCheck = !!click.affiliateId && rules.some((r) => r.targeting.affiliateGroupIds.length > 0);
  const affiliateGroupIds = needsGroupCheck
    ? (await affiliateGroupRepository.findAll()).filter((g) => g.affiliateIds.includes(click.affiliateId!)).map((g) => g.id)
    : [];

  const matching = rules.find((r) => ruleMatchesClick(r.targeting, click, affiliateGroupIds));
  return matching ?? rules.find(isWildcardRule) ?? rules[0]!;
}

function isWildcardRule(r: PayoutRule): boolean {
  return isWildcard(r.targeting);
}

// Both amounts always come from the rule, never from the postback payload (money
// integrity rule, PLAN-backend.md). PERCENTAGE payoutType applies the rule's own
// percentage against the rule's own revenueAmount — no externally-reported sale value
// is ever consulted, so there is nothing here an advertiser could inflate.
function computeAmounts(rule: PayoutRule): { revenueAmount: number; payoutAmount: number } {
  const revenueAmount = Number(rule.revenueAmount);
  const ruleAmount = Number(rule.amount);
  const payoutAmount = rule.payoutType === PayoutType.PERCENTAGE ? Number(((ruleAmount / 100) * revenueAmount).toFixed(2)) : ruleAmount;
  return { revenueAmount, payoutAmount };
}

async function logAttempt(
  req: PostbackRequest,
  fields: { offerId: string | null; affiliateId?: string | null; conversionId?: string | null; success: boolean; errorMessage?: string },
): Promise<void> {
  await postbackLogRepository.create({
    conversionId: fields.conversionId ?? null,
    offerId: fields.offerId,
    affiliateId: fields.affiliateId ?? null,
    direction: PostbackDirection.INBOUND,
    payload: req.rawQuery,
    responseStatus: fields.success ? 200 : 404,
    success: fields.success,
    errorMessage: fields.errorMessage ?? null,
    sourceIp: req.sourceIp,
  });
}

export const postbackService = {
  async handlePostback(req: PostbackRequest): Promise<PostbackResult> {
    const offer = await offerRepository.findByIdWithPayoutRules(req.offerId);

    // Same generic failure for "offer doesn't exist" and "wrong secret/IP" — a
    // different status code between the two would let a caller probe for valid
    // offerIds by trying secrets against each one.
    if (!offer || !offer.postbackSecret || !offer.allowedPostbackIps) {
      await logAttempt(req, { offerId: req.offerId, success: false, errorMessage: 'Offer not found or not configured for postbacks' });
      throw new NotFoundError('Offer not available');
    }
    if (!secretsMatch(req.secret, offer.postbackSecret) || !ipAllowed(req.sourceIp, offer.allowedPostbackIps)) {
      await logAttempt(req, { offerId: offer.id, success: false, errorMessage: 'Secret or source IP not authorized' });
      throw new NotFoundError('Offer not available');
    }

    const click = await clickRepository.findById(req.clickId);
    // A click_id that resolves but belongs to a different offer is treated the same
    // as no click at all — never attribute a conversion to a click it didn't earn.
    const matchedClick = click && click.offerId === offer.id ? click : null;

    const existingConversion = matchedClick ? await conversionRepository.findByClickId(matchedClick.id) : null;
    const isDuplicate = !!existingConversion;

    const rule = await resolvePayoutRule(offer, matchedClick);
    const amounts = rule ? computeAmounts(rule) : { revenueAmount: 0, payoutAmount: 0 };
    // Duplicates are recorded (visible in the Conversions report, filterable by
    // isDuplicate) but carry zero money so an accidental double-fire can never
    // inflate revenue/payout totals before someone reviews it.
    const revenueAmount = isDuplicate ? 0 : amounts.revenueAmount;
    const payoutAmount = isDuplicate ? 0 : amounts.payoutAmount;

    let status = ConversionStatus.PENDING;
    let approvedAt: Date | null = null;
    if (isDuplicate) {
      status = ConversionStatus.DUPLICATE;
    } else if (!rule?.holdEnabled && offer.autoApproveConversions) {
      status = ConversionStatus.APPROVED;
      approvedAt = new Date();
    }

    const conversion = await conversionRepository.create({
      clickId: matchedClick?.id ?? null,
      offerId: offer.id,
      affiliateId: matchedClick?.affiliateId ?? null,
      revenueAmount: revenueAmount.toFixed(2),
      payoutAmount: payoutAmount.toFixed(2),
      currency: offer.currency,
      status,
      isDuplicate,
      isOrphan: !matchedClick,
      ctitMs: matchedClick ? Date.now() - matchedClick.createdAt.getTime() : null,
      subId1: matchedClick?.subId1 ?? null,
      subId2: matchedClick?.subId2 ?? null,
      subId3: matchedClick?.subId3 ?? null,
      subId4: matchedClick?.subId4 ?? null,
      subId5: matchedClick?.subId5 ?? null,
      subId6: matchedClick?.subId6 ?? null,
      subId7: matchedClick?.subId7 ?? null,
      subId8: matchedClick?.subId8 ?? null,
      countryCode: matchedClick?.countryCode ?? null,
      transactionId: req.transactionId,
      approvedAt,
    });

    await logAttempt(req, {
      offerId: offer.id,
      affiliateId: conversion.affiliateId,
      conversionId: conversion.id,
      success: true,
    });

    // First real, authenticated postback ever received for this offer — an
    // observational signal for admins, not a gate (see offer.service.ts).
    if (!offer.postbackVerifiedAt) {
      await offerRepository.markPostbackVerified(offer.id, new Date());
    }

    return { conversionId: conversion.id };
  },
};
