import { createHash, timingSafeEqual } from 'node:crypto';
import { NotFoundError } from '../../common/errors';
import { offerRepository } from '../offers/offer.repository';
import { clickRepository } from '../clicks/click.repository';
import { conversionRepository } from '../conversions/conversion.repository';
import { ConversionStatus } from '../conversions/conversion.entity';
import { postbackLogRepository } from '../postback-logs/postback-log.repository';
import { smartLinkRepository } from '../smart-links/smart-link.repository';
import { globalPostbackRepository } from '../global-postbacks/global-postback.repository';
import { PostbackDirectionKind } from '../global-postbacks/global-postback.entity';
import { PostbackDirection } from '../postback-logs/postback-log.entity';
import { resolvePayoutRuleForPricing, computeAmounts } from '../offers/payout-resolution';
import { safeSendConversionPostback } from './outbound-postback.service';

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

/**
 * Returns the id of the enabled global inbound entry that accepts this request, or null.
 *
 * Every candidate is compared even after one matches — `secretsMatch` is constant-time
 * per comparison, but bailing out early would still make the total time depend on which
 * entry matched, and with a handful of rows the cost of checking them all is nothing.
 *
 * A null `allowedIps` means any address: a global entry usually fronts a platform whose
 * egress addresses the operator does not control, and requiring a placeholder there
 * would be a restriction in appearance only.
 */
async function matchGlobalInbound(secret: string, sourceIp: string): Promise<string | null> {
  const entries = await globalPostbackRepository.findEnabled(PostbackDirectionKind.INBOUND);
  let matched: string | null = null;
  for (const entry of entries) {
    if (!entry.secret) continue;
    const ok = secretsMatch(secret, entry.secret) && (!entry.allowedIps || ipAllowed(sourceIp, entry.allowedIps));
    if (ok && !matched) matched = entry.id;
  }
  return matched;
}

function ipAllowed(sourceIp: string, allowedPostbackIps: string): boolean {
  const allowed = allowedPostbackIps
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean);
  return allowed.includes(sourceIp);
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
      // Fall back to the network-level entries before rejecting. A global postback is
      // how one advertiser integration covers every offer instead of needing fresh
      // credentials per offer — see global-postback.entity.ts.
      const authorisedBy = await matchGlobalInbound(req.secret, req.sourceIp);
      if (!authorisedBy) {
        await logAttempt(req, { offerId: offer.id, success: false, errorMessage: 'Secret or source IP not authorized' });
        throw new NotFoundError('Offer not available');
      }
      await globalPostbackRepository.markUsed(authorisedBy);
    }

    const click = await clickRepository.findById(req.clickId);
    // A click_id that resolves but belongs to a different offer is treated the same
    // as no click at all — never attribute a conversion to a click it didn't earn.
    const matchedClick = click && click.offerId === offer.id ? click : null;

    const existingConversion = matchedClick ? await conversionRepository.findByClickId(matchedClick.id) : null;
    const isDuplicate = !!existingConversion;

    const rule = await resolvePayoutRuleForPricing(offer.payoutRules, matchedClick);

    // A click that came through a smart-link is priced against that link's revenue
    // share rather than the member offer's own payout — read now, at conversion time,
    // so a rate changed after the click applies to what is actually being paid.
    const smartLink = matchedClick?.smartLinkId ? await smartLinkRepository.findById(matchedClick.smartLinkId) : null;
    const revSharePercent = smartLink?.revSharePercent != null ? Number(smartLink.revSharePercent) : null;

    const amounts = rule ? computeAmounts(rule, revSharePercent) : { revenueAmount: 0, payoutAmount: 0 };
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

    // Auto-approved conversions never pass through conversion.updateStatus, so the
    // affiliate's own tracker would never hear about the ones that need no review —
    // the majority, on an offer with autoApproveConversions on.
    if (status === ConversionStatus.APPROVED) {
      safeSendConversionPostback(conversion);
    }

    // First real, authenticated postback ever received for this offer — an
    // observational signal for admins, not a gate (see offer.service.ts).
    if (!offer.postbackVerifiedAt) {
      await offerRepository.markPostbackVerified(offer.id, new Date());
    }

    return { conversionId: conversion.id };
  },
};
