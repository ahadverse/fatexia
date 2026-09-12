import { randomUUID } from 'node:crypto';
import { UAParser } from 'ua-parser-js';
import { NotFoundError } from '../../common/errors';
import { logger } from '../../common/logger';
import { offerRepository } from '../offers/offer.repository';
import { OfferStatus, type Offer } from '../offers/offer.entity';
import type { PayoutRule } from '../offers/payout-rule.entity';
import { smartLinkRepository } from '../smart-links/smart-link.repository';
import { SmartLinkStatus, type SmartLink } from '../smart-links/smart-link.entity';
import { buildCandidates, linkAcceptsVisitor, pickCandidate } from '../smart-links/smart-link-resolution';
import { geoSource } from '../geo-source/geo-source';
import { isLikelyDatacenter } from '../fraud/datacenter-filter';
import { checkResidentialProxy } from '../fraud/proxy-detection';
import { getTrackerSettings } from '../network-settings/tracker-settings';
import { findMatchingRuleForClick, computeAmounts } from '../offers/payout-resolution';
import { clickRepository } from './click.repository';
import { ClickQualityStatus } from './click.entity';
import { isFirstClick } from './unique-click';

/**
 * What the visitor clicked.
 *
 * A normal tracking link names its offer up front; a smart-link names a slug and the
 * offer is chosen at redirect time from the visitor's geo/device. Modelled as one
 * union rather than two parallel handlers because everything after the choice — geo,
 * fraud scoring, the click row, the macro substitution — is identical, and the one
 * thing a second copy of this pipeline would guarantee is that the two drift.
 */
export type ClickTarget = { kind: 'offer'; offerId: string } | { kind: 'smartLink'; slug: string };

export interface ClickRequest {
  target: ClickTarget;
  affiliateId: string | null;
  ip: string;
  userAgent: string | null;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  subId5: string | null;
  subId6: string | null;
  subId7: string | null;
  subId8: string | null;
  referer: string | null;
}

export interface ClickResult {
  redirectUrl: string;
  clickId: string;
}

// Bands come from Network Settings, not from constants here — that page has offered
// inputs for them since it was built and nothing read them, so the values were
// editable and inert.
function scoreClick(
  isDatacenter: boolean,
  isProxyOrVpn: boolean | null,
  thresholds: { suspectThreshold: number; blockThreshold: number },
): { riskScore: number; qualityStatus: ClickQualityStatus } {
  let riskScore = 0;
  if (isDatacenter) riskScore += 70;
  if (isProxyOrVpn === true) riskScore += 50;

  let qualityStatus: ClickQualityStatus;
  if (riskScore >= thresholds.blockThreshold) {
    qualityStatus = ClickQualityStatus.BLOCKED;
  } else if (riskScore >= thresholds.suspectThreshold) {
    qualityStatus = ClickQualityStatus.SUSPECT;
  } else if (isProxyOrVpn === null) {
    // Datacenter check ran and said no, but the proxy-detection layer never resolved
    // (unconfigured/exhausted/failed) — genuinely unscored, not confidently clean.
    qualityStatus = ClickQualityStatus.UNSCORED;
  } else {
    qualityStatus = ClickQualityStatus.GOOD;
  }
  return { riskScore, qualityStatus };
}

/**
 * Loads what the target points at, before any of the fraud pipeline runs.
 *
 * Kept as an up-front step so an unknown offer or a dead slug still 404s immediately
 * rather than after a geo lookup and a billed proxy-detection call.
 */
async function loadTarget(
  target: ClickTarget,
): Promise<{ offer: Offer; link: null } | { offer: null; link: SmartLink; members: Offer[] }> {
  if (target.kind === 'offer') {
    // One query with a join, not a bare PK read — payoutRules are needed for the
    // geo/device/OS routing decision below (issue #15). Still a single round-trip,
    // which is what the hot-path requirement (PLAN-tracker.md) actually asks for.
    const offer = await offerRepository.findByIdWithPayoutRules(target.offerId);
    if (!offer || offer.status !== OfferStatus.APPROVED || !offer.destinationUrl) {
      throw new NotFoundError('Offer not available');
    }
    return { offer, link: null };
  }

  const link = await smartLinkRepository.findBySlug(target.slug);
  if (!link || link.status !== SmartLinkStatus.ACTIVE) {
    throw new NotFoundError('Smart-link not available');
  }
  return { offer: null, link, members: await offerRepository.findApprovedByIdsWithPayoutRules(link.offerIds) };
}

export const clickService = {
  async handleClick(req: ClickRequest): Promise<ClickResult> {
    const target = await loadTarget(req.target);

    const clickId = randomUUID();

    // Fraud signals: datacenter/geo are always-on local lookups (no external call);
    // the residential-proxy check is best-effort and may resolve to null (see
    // proxy-detection.ts) — none of this blocks the redirect below.
    const settings = await getTrackerSettings();

    const { asn, countryCode, city, region, regionCode } = await geoSource.lookup(req.ip);
    const isDatacenter = isLikelyDatacenter(asn);
    const isProxyOrVpn = await checkResidentialProxy(req.ip);
    const { riskScore, qualityStatus } = scoreClick(isDatacenter, isProxyOrVpn, settings);

    const ua = req.userAgent ? UAParser(req.userAgent) : null;
    // ua-parser-js only sets device.type for mobile/tablet/console/smarttv/wearable/
    // embedded — a regular desktop browser leaves it undefined by design (there's no
    // "desktop" entry in its taxonomy). Without this fallback every desktop click showed
    // a blank Device column, in the drawer and in the device-grouped reports alike.
    const deviceType = ua?.device.type ?? (req.userAgent ? 'desktop' : null);
    const os = ua?.os.name ?? null;

    const matchable = { countryCode, deviceType, os, affiliateId: req.affiliateId };

    // Smart-link: choose the member offer now that the visitor is known. A link that
    // resolves to nothing redirects to its own fallback and is deliberately NOT
    // logged — clicks.offerId is NOT NULL, and there is no honest offer to attribute
    // this click to.
    let offer: Offer;
    let preMatchedRule: PayoutRule | null = null;
    // Kept for the click row: the conversion that arrives later needs to know this came
    // through a smart-link, to price it against that link's revenue share.
    let smartLinkId: string | null = null;
    // The link's own settings, read once here so the redirect and the payout below
    // don't each have to re-check whether this click came through a smart-link.
    let smartLinkDestinationUrl: string | null = null;
    let revSharePercent: number | null = null;
    if (target.offer) {
      offer = target.offer;
    } else {
      const { link, members } = target;
      const candidates = linkAcceptsVisitor(link, matchable) ? await buildCandidates(members, matchable) : [];
      if (candidates.length === 0) {
        if (!link.fallbackUrl) {
          throw new NotFoundError('No offer available for this smart-link');
        }
        return { redirectUrl: link.fallbackUrl, clickId };
      }
      const chosen = await pickCandidate(link, candidates);
      offer = chosen.offer;
      // The rotation already resolved this click's rule; re-resolving it below could
      // pick a different one and price the redirect differently from the offer that
      // was chosen on the strength of that price.
      preMatchedRule = chosen.rule;
      smartLinkId = link.id;
      smartLinkDestinationUrl = link.destinationUrl;
      revSharePercent = link.revSharePercent != null ? Number(link.revSharePercent) : null;
    }

    // One Redis round-trip, alongside the proxy check that may already have made an
    // external HTTP call — this adds nothing meaningful to the hot path.
    const isUnique = await isFirstClick(offer.id, req.ip);

    // Fire-and-forget: the redirect must not wait on this write. A full batched-flush
    // buffer (Redis/queue) is the production version of this — see PLAN-tracker.md;
    // this direct insert is the correctness-first version for now.
    clickRepository
      .create({
        id: clickId,
        offerId: offer.id,
        affiliateId: req.affiliateId,
        smartLinkId,
        ip: req.ip,
        userAgent: req.userAgent,
        countryCode,
        city,
        region,
        regionCode,
        // UAParser already returns the vendor and both version strings — the previous
        // version parsed them and then dropped them on the floor.
        deviceType,
        deviceBrand: ua?.device.vendor ?? null,
        os,
        osVersion: ua?.os.version ?? null,
        browser: ua?.browser.name ?? null,
        browserVersion: ua?.browser.version ?? null,
        asn,
        isDatacenter,
        isProxyOrVpn,
        isUnique,
        subId1: req.subId1,
        subId2: req.subId2,
        subId3: req.subId3,
        subId4: req.subId4,
        subId5: req.subId5,
        subId6: req.subId6,
        subId7: req.subId7,
        subId8: req.subId8,
        referer: req.referer,
        riskScore,
        qualityStatus,
      })
      .catch((err) => logger.error({ err, clickId }, 'Failed to log click'));

    if (qualityStatus === ClickQualityStatus.BLOCKED) {
      // Per-offer override first — some advertisers require rejected traffic to land
      // on their own "offer unavailable" page — then the network-wide setting, then
      // the built-in default.
      return { redirectUrl: offer.blockedRedirectUrl?.trim() || settings.blockedRedirectUrl, clickId };
    }

    // Issue #15: route by the offer's own geo/device/OS targeting. A rule with empty
    // targeting (the common case today) matches everything, so this is a no-op for
    // every offer that hasn't configured targeting — only a genuinely non-matching
    // click (one that fits none of the offer's targeted rules) falls through to
    // fallbackUrl instead of destinationUrl.
    //
    // A smart-link click already has its rule from the rotation, so this is skipped
    // there rather than resolved a second time.
    const matchedRule = preMatchedRule ?? (await findMatchingRuleForClick(offer.payoutRules, matchable));

    if (!matchedRule) {
      const fallback = offer.fallbackUrl?.trim() || offer.destinationUrl!;
      return { redirectUrl: fallback.replace('{click_id}', clickId).replace('{payout_amount}', ''), clickId };
    }

    const { payoutAmount } = computeAmounts(matchedRule, revSharePercent);

    // A smart-link may override where its traffic lands. The member offer is still
    // chosen, logged and paid against — only the address changes — so a network that
    // routes all rotator traffic through its own page keeps correct attribution.
    // Unset (the normal case) falls through to the chosen offer's own destination.
    const destination = smartLinkDestinationUrl?.trim() || offer.destinationUrl!;
    return {
      redirectUrl: destination.replace('{click_id}', clickId).replace('{payout_amount}', payoutAmount.toFixed(2)),
      clickId,
    };
  },
};
