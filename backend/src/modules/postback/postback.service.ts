import { createHash, timingSafeEqual } from 'node:crypto';
import { NotFoundError, ValidationError } from '../../common/errors';
import { offerRepository } from '../offers/offer.repository';
import { clickRepository } from '../clicks/click.repository';
import { conversionRepository } from '../conversions/conversion.repository';
import { ConversionStatus } from '../conversions/conversion.entity';
import { postbackLogRepository } from '../postback-logs/postback-log.repository';
import { smartLinkRepository } from '../smart-links/smart-link.repository';
import { globalPostbackRepository } from '../global-postbacks/global-postback.repository';
import { PostbackDirectionKind } from '../global-postbacks/global-postback.entity';
import { PostbackDirection } from '../postback-logs/postback-log.entity';
import { resolvePayoutRuleForPricing, computeAmounts, computeSmartLinkAmounts } from '../offers/payout-resolution';
import { networkSettingRepository } from '../network-settings/network-setting.repository';
import type { Click } from '../clicks/click.entity';
import { safeSendConversionPostback } from './outbound-postback.service';
import { announceConversion } from '../conversions/conversion-announce';

export interface PostbackRequest {
  /** Absent on a global postback — the click names the offer instead. */
  offerId: string | null;
  clickId: string;
  secret: string;
  transactionId: string | null;
  /**
   * The sale's revenue as the advertiser reported it, already normalised from whichever
   * spelling they used (`sum` or `revenue`). Null when they sent no amount, which keeps
   * meaning "price this from the rule's configured revenue".
   */
  reportedRevenue: number | null;
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

/**
 * A conversion on a smart-link that has no member offers.
 *
 * There is no offer anywhere in this path, so none of the offer-shaped machinery
 * applies: no payout rule, and no offer to read a currency or an approval flag off.
 * What replaces each is named below, and the shape of the resulting row is identical
 * apart from a null `offerId`.
 *
 * Authorisation mirrors the offer path exactly: the link's own credentials, or the
 * network-level entry. Until the link had credentials of its own, the global entry was
 * the only way in — which is why the link is now loaded before the gate rather than
 * after it.
 */
async function handleOfferlessSmartLinkPostback(
  req: PostbackRequest,
  click: Click,
  smartLinkId: string,
  globalAuthId: string | null,
): Promise<PostbackResult> {
  const link = await smartLinkRepository.findById(smartLinkId);

  // Both halves required, exactly as `offerAuthorised` demands both: a secret with no
  // IP allowlist is a shared string that authorises from anywhere.
  const linkAuthorised =
    !!link?.postbackSecret &&
    !!link.allowedPostbackIps &&
    secretsMatch(req.secret, link.postbackSecret) &&
    ipAllowed(req.sourceIp, link.allowedPostbackIps);

  if (!linkAuthorised && !globalAuthId) {
    await logAttempt(req, { offerId: null, success: false, errorMessage: 'Secret or source IP not authorized' });
    // The same generic message every other rejection uses, so a caller cannot tell the
    // difference between a bad secret and a link that does not work this way.
    throw new NotFoundError('Offer not available');
  }
  if (globalAuthId) await globalPostbackRepository.markUsed(globalAuthId);
  if (linkAuthorised && !link.postbackVerifiedAt) {
    await smartLinkRepository.markPostbackVerified(link.id);
  }

  if (req.reportedRevenue == null) {
    await logAttempt(req, {
      offerId: null,
      affiliateId: click.affiliateId,
      success: false,
      errorMessage: 'No sale amount sent — add &sum={sum} to the postback URL',
    });
    throw new ValidationError('This postback must carry the sale amount as `sum` (or `revenue`)');
  }

  const revSharePercent = link?.revSharePercent != null ? Number(link.revSharePercent) : null;
  const amounts = computeSmartLinkAmounts(revSharePercent, req.reportedRevenue);
  if (!amounts) {
    // Refused rather than booked at zero. A conversion worth nothing looks, in every
    // report, like traffic that did not earn — not like a link missing its rate.
    await logAttempt(req, {
      offerId: null,
      affiliateId: click.affiliateId,
      success: false,
      errorMessage: 'Smart-link has no revenue share, so there is no rate to price this conversion with',
    });
    throw new ValidationError('This smart-link has no revenue share set, so the conversion cannot be priced');
  }

  const existingConversion = await conversionRepository.findByClickId(click.id);
  const isDuplicate = !!existingConversion;

  // No offer to read a currency or an approval flag off. The currency is the network's
  // — a smart-link has none of its own — and the approval decision is the link's when
  // it has made one, the network's when it has not.
  const settings = (await networkSettingRepository.find()) ?? (await networkSettingRepository.createDefault());
  const currency = settings.defaultCurrency;
  // `??`, not `||`: `false` on the link is a decision to hold, and must not fall
  // through to a network setting that says auto-approve.
  const autoApprove = link?.autoApproveConversions ?? settings.autoApproveConversions;

  const conversion = await conversionRepository.create({
    clickId: click.id,
    offerId: null,
    affiliateId: click.affiliateId,
    // Duplicates carry zero money here for the same reason they do on the offer path:
    // an advertiser double-firing must not inflate a total before anyone reviews it.
    revenueAmount: (isDuplicate ? 0 : amounts.revenueAmount).toFixed(2),
    payoutAmount: (isDuplicate ? 0 : amounts.payoutAmount).toFixed(2),
    reportedRevenue: req.reportedRevenue.toFixed(2),
    currency,
    status: isDuplicate ? ConversionStatus.DUPLICATE : autoApprove ? ConversionStatus.APPROVED : ConversionStatus.PENDING,
    approvedAt: !isDuplicate && autoApprove ? new Date() : null,
    isDuplicate,
    // It has a click by construction — that is how this path was reached.
    isOrphan: false,
    ctitMs: Date.now() - click.createdAt.getTime(),
    subId1: click.subId1,
    subId2: click.subId2,
    subId3: click.subId3,
    subId4: click.subId4,
    subId5: click.subId5,
    subId6: click.subId6,
    subId7: click.subId7,
    subId8: click.subId8,
    countryCode: click.countryCode,
    transactionId: req.transactionId,
  });

  await logAttempt(req, {
    offerId: null,
    affiliateId: click.affiliateId,
    conversionId: conversion.id,
    success: true,
  });

  if (conversion.status === ConversionStatus.APPROVED) {
    await safeSendConversionPostback(conversion);
  }
  // No offer name to announce — the alert shows the link's traffic, not an offer's.
  announceConversion({ ...conversion, offerName: null }, 'postback');

  return { conversionId: conversion.id };
}

export const postbackService = {
  async handlePostback(req: PostbackRequest): Promise<PostbackResult> {
    // The click is loaded first because it, not the caller, decides which offer this
    // conversion belongs to when no offerId was sent.
    // By refId or uuid — see clickRepository.findByPostbackId for why both.
    const click = await clickRepository.findByPostbackId(req.clickId);

    // Global authorisation is checked before anything offer-specific. It used to be a
    // fallback *after* the per-offer gate, which made it unreachable in exactly the
    // case it exists for: an offer with no credentials of its own was rejected on the
    // line above, so the network-level entry never got a look.
    const globalAuthId = await matchGlobalInbound(req.secret, req.sourceIp);

    // The caller's value may be the offer's refId or its uuid; the click's is always a
    // uuid. findForClick takes either, so both paths resolve through one read.
    const offerId = req.offerId ?? click?.offerId ?? null;
    const offer = offerId ? await offerRepository.findForClick(offerId) : null;

    // A click through a smart-link with no member offers has no offer and never will —
    // it was sold against the link's own revenue share. Handled as its own path rather
    // than as a failure: authorisation comes from the network-level postback entry (the
    // only one there can be, since an offer secret needs an offer), and the price comes
    // from the link.
    const offerlessSmartLinkId = !offer && click && click.offerId === null ? click.smartLinkId : null;

    if (!offer && !offerlessSmartLinkId) {
      // Not `offerId`: the caller's value may be a refId, and the log column is a uuid.
      // Nothing is lost — the whole query string is stored as the payload.
      await logAttempt(req, { offerId: null, success: false, errorMessage: 'Offer not found, and no click to resolve one from' });
      throw new NotFoundError('Offer not available');
    }

    if (offerlessSmartLinkId) {
      return await handleOfferlessSmartLinkPostback(req, click!, offerlessSmartLinkId, globalAuthId);
    }

    // Unreachable: the guard above throws when there is no offer and no offer-less link,
    // and the branch above returns for the link case. Written out rather than asserted
    // with `!` so that if either condition above is ever changed, this fails loudly here
    // instead of dereferencing null halfway through pricing a conversion.
    if (!offer) {
      throw new NotFoundError('Offer not available');
    }

    // Same generic failure for every rejection — a distinguishable response would let a
    // caller probe for valid offer ids, or for which secrets are live, by trying them.
    const offerAuthorised =
      !!offer.postbackSecret &&
      !!offer.allowedPostbackIps &&
      secretsMatch(req.secret, offer.postbackSecret) &&
      ipAllowed(req.sourceIp, offer.allowedPostbackIps);

    if (!offerAuthorised && !globalAuthId) {
      await logAttempt(req, { offerId: offer.id, success: false, errorMessage: 'Secret or source IP not authorized' });
      throw new NotFoundError('Offer not available');
    }
    if (globalAuthId) await globalPostbackRepository.markUsed(globalAuthId);

    // A click_id that resolves but belongs to a different offer is treated the same
    // as no click at all — never attribute a conversion to a click it didn't earn.
    // When the offer came *from* the click this always holds; it still matters for the
    // per-offer URLs, where the caller supplies both and they can disagree.
    const matchedClick = click && click.offerId === offer.id ? click : null;

    const existingConversion = matchedClick ? await conversionRepository.findByClickId(matchedClick.id) : null;
    const isDuplicate = !!existingConversion;

    const rule = await resolvePayoutRuleForPricing(offer.payoutRules, matchedClick);

    // A click that came through a smart-link is priced against that link's revenue
    // share rather than the member offer's own payout — read now, at conversion time,
    // so a rate changed after the click applies to what is actually being paid.
    const smartLink = matchedClick?.smartLinkId ? await smartLinkRepository.findById(matchedClick.smartLinkId) : null;
    const revSharePercent = smartLink?.revSharePercent != null ? Number(smartLink.revSharePercent) : null;

    // Only the rate stays ours — this is the base it is applied to (see computeAmounts).
    //
    // Required, and enforced *here* rather than in the query schema on purpose. A schema
    // rejection happens before this function runs, so it would never reach logAttempt:
    // an advertiser still posting the old URL would have every conversion dropped with
    // nothing in the postback log to show it. Checked after authorisation instead, so a
    // missing amount is a visible, attributable failure the admin can chase — and so an
    // unauthenticated caller still learns nothing about which parameters matter.
    const reportedRevenue = req.reportedRevenue;
    if (reportedRevenue == null) {
      await logAttempt(req, {
        offerId: offer.id,
        affiliateId: matchedClick?.affiliateId ?? null,
        success: false,
        errorMessage: 'No sale amount sent — add &sum={sum} to the postback URL',
      });
      throw new ValidationError('This postback must carry the sale amount as `sum` (or `revenue`)');
    }

    const amounts = rule
      ? computeAmounts(rule, revSharePercent, reportedRevenue)
      : { revenueAmount: 0, payoutAmount: 0 };
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
      // Stored whatever the pricing did with it — including on a duplicate, which is
      // priced at zero. What the advertiser reported is a fact about the request, and
      // the row is the only place it survives; the payload log is keyed to the attempt,
      // not to the conversion someone is reviewing.
      reportedRevenue: reportedRevenue != null ? reportedRevenue.toFixed(2) : null,
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

    // Announced from the Tracker, which has no socket server of its own — the emit
    // crosses to the API over Redis (see infra/realtime/socket-server.ts), so an admin
    // watching the portal sees this land the moment the advertiser reports it.
    announceConversion({ ...conversion, offerName: offer.name }, 'postback');

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
