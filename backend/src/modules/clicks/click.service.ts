import { randomUUID } from 'node:crypto';
import { UAParser } from 'ua-parser-js';
import { NotFoundError } from '../../common/errors';
import { logger } from '../../common/logger';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { offerRepository } from '../offers/offer.repository';
import { OfferStatus, type Offer } from '../offers/offer.entity';
import type { PayoutRule } from '../offers/payout-rule.entity';
import { smartLinkRepository } from '../smart-links/smart-link.repository';
import { SmartLinkStatus, type SmartLink } from '../smart-links/smart-link.entity';
import { buildCandidates, linkAcceptsVisitor, pickCandidate } from '../smart-links/smart-link-resolution';
import { geoSource } from '../geo-source/geo-source';
import { isLikelyDatacenter } from '../fraud/datacenter-filter';
import { checkResidentialProxy, type ProxyVerdict } from '../fraud/proxy-detection';
import { getTrackerSettings } from '../network-settings/tracker-settings';
import { findMatchingRuleForClick, computeAmounts } from '../offers/payout-resolution';
import { clickRepository } from './click.repository';
import { nextClickRefId } from './click-ref-id';
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
  /** The internal uuid — logged, and what the click row is keyed on. */
  clickId: string;
  /** The short number put on the redirect as `click_id` and posted back to us. */
  clickRefId: number;
}

// Bands come from Network Settings, not from constants here — that page has offered
// inputs for them since it was built and nothing read them, so the values were
// editable and inert.
function scoreClick(
  isDatacenter: boolean,
  verdict: ProxyVerdict | null,
  thresholds: { suspectThreshold: number; blockThreshold: number },
): { riskScore: number; qualityStatus: ClickQualityStatus } {
  let riskScore = 0;
  if (isDatacenter) riskScore += 70;
  if (verdict?.flagged === true) riskScore += 50;

  // Nothing is added for the provider's ISP/ASN/country disagreeing with MaxMind's,
  // although both readings are now stored. A disagreement is usually the local .mmdb
  // being months old rather than the visitor hiding anything, and a risk weight would
  // charge the affiliate for our refresh schedule. It belongs on a "GeoIP looks stale"
  // operational check, not on the click.

  let qualityStatus: ClickQualityStatus;
  if (riskScore >= thresholds.blockThreshold) {
    qualityStatus = ClickQualityStatus.BLOCKED;
  } else if (riskScore >= thresholds.suspectThreshold) {
    qualityStatus = ClickQualityStatus.SUSPECT;
  } else if (verdict === null) {
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
    // findForClick, not findByIdWithPayoutRules: the link may name the offer by its
    // short refId or by the uuid older links carry.
    const offer = await offerRepository.findForClick(target.offerId);
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
    // Resolved together: a link naming the affiliate by number costs a lookup, and
    // there is no reason for it to sit behind the offer's.
    const [target, affiliateId] = await Promise.all([
      loadTarget(req.target),
      req.affiliateId === null ? Promise.resolve(null) : affiliateRepository.resolveIdForClick(req.affiliateId),
    ]);

    const clickId = randomUUID();
    // The number the advertiser will see and post back. Drawn from a block this process
    // reserved earlier, so it costs nothing here (see click-ref-id.ts).
    const clickRefId = await nextClickRefId();

    // Fraud signals: datacenter/geo are always-on local lookups (no external call);
    // the residential-proxy check is best-effort and may resolve to null (see
    // proxy-detection.ts) — none of this blocks the redirect below.
    const settings = await getTrackerSettings();

    const geo = await geoSource.lookup(req.ip);
    const { asn, countryCode } = geo;
    const isDatacenter = isLikelyDatacenter(asn);
    const proxyVerdict = await checkResidentialProxy(req.ip);
    const isProxyOrVpn = proxyVerdict === null ? null : proxyVerdict.flagged;
    const { riskScore, qualityStatus } = scoreClick(isDatacenter, proxyVerdict, settings);

    const ua = req.userAgent ? UAParser(req.userAgent) : null;
    // ua-parser-js only sets device.type for mobile/tablet/console/smarttv/wearable/
    // embedded — a regular desktop browser leaves it undefined by design (there's no
    // "desktop" entry in its taxonomy). Without this fallback every desktop click showed
    // a blank Device column, in the drawer and in the device-grouped reports alike.
    const deviceType = ua?.device.type ?? (req.userAgent ? 'desktop' : null);
    const os = ua?.os.name ?? null;

    const matchable = { countryCode, deviceType, os, affiliateId };

    // Smart-link: choose the member offer now that the visitor is known.
    //
    // Null for a link with no member offers. Those sell against the link's own revenue
    // share rather than an offer's payout rule, so there is no offer to name and the
    // click is logged with `offerId` null and `smartLinkId` carrying the attribution.
    // (A link whose members exist but exclude this visitor is a different case and still
    // redirects to fallbackUrl unlogged — there the link does have offers.)
    let offer: Offer | null = null;
    // What uniqueness is counted against. An offer for a normal click, the link itself
    // for an offer-less one — otherwise every memberless click across every link would
    // share one bucket and only the first would ever read as unique.
    let uniquenessKey: string;
    // Where an offer-less link sends its traffic, resolved in the branch below so the
    // redirect at the end does not have to re-derive it.
    let memberlessDestination: string | null = null;
    let preMatchedRule: PayoutRule | null = null;
    // Kept for the click row: the conversion that arrives later needs to know this came
    // through a smart-link, to price it against that link's revenue share.
    let smartLinkId: string | null = null;
    // The link's own settings, read once here so the redirect and the payout below
    // don't each have to re-check whether this click came through a smart-link.
    let smartLinkDestinationUrl: string | null = null;
    // Where BLOCKED traffic through this link goes. Read alongside the rest so the
    // block branch below can prefer it without reloading the link.
    let smartLinkBlockedRedirectUrl: string | null = null;
    let revSharePercent: number | null = null;
    if (target.offer) {
      offer = target.offer;
      uniquenessKey = offer.id;
    } else {
      const { link, members } = target;

      // No member offers configured at all — the link is a plain redirect, and every
      // visitor goes to its own destination.
      //
      // Deliberately keyed on `offerIds`, not on `members` being empty. A link whose
      // members are all unapproved has members; that visitor belongs on fallbackUrl
      // below, where "the link has offers and you were excluded from them" is the right
      // answer. Collapsing the two would silently send an unapproved offer's traffic to
      // the network's own page instead.
      //
      // The destination is guaranteed by createSmartLinkSchema and updateSmartLink, but
      // a link written before that rule existed must still not 500 its visitors, so
      // fallbackUrl is honoured as a second choice before giving up.
      if ((link.offerIds ?? []).length === 0) {
        // The link's own geo/device gate applies here too. It is checked below for a
        // link with members, and skipping it here would make the Countries and Devices
        // fields silently inert on exactly the links that have nothing else to filter
        // on — set in the form, ignored on every click.
        //
        // An excluded visitor goes to fallbackUrl, which is what that field means: the
        // link matched nobody for this visitor. A link with no fallback has nowhere to
        // put them, and sending them to the destination anyway would defeat the gate.
        if (!linkAcceptsVisitor(link, matchable)) {
          if (!link.fallbackUrl) {
            throw new NotFoundError('No offer available for this smart-link');
          }
          return { redirectUrl: link.fallbackUrl, clickId, clickRefId };
        }

        const direct = link.destinationUrl?.trim() || link.fallbackUrl?.trim();
        if (!direct) {
          throw new NotFoundError('No offer available for this smart-link');
        }
        // Falls through to the click write rather than returning here. The row is what
        // makes a conversion possible at all: `/postback` finds the click by its refId,
        // reads `smartLinkId` off it, and prices the sale against the link's own share.
        // Returning early — which this used to do — meant the redirect carried a click
        // id naming a row that did not exist, so every postback against it was rejected.
        memberlessDestination = direct;
        uniquenessKey = link.id;
        smartLinkId = link.id;
        smartLinkBlockedRedirectUrl = link.blockedRedirectUrl;
        revSharePercent = link.revSharePercent != null ? Number(link.revSharePercent) : null;
      } else {
        // The link's share is read here, before the rotation, because TOP_PAYOUT ranks on
        // the payout it produces — see buildCandidates. Read again below for the redirect's
        // own pricing; one read for both would be tidier but this value is also what
        // decides which offer is chosen, so it has to exist before the choice is made.
        const linkRevShare = link.revSharePercent != null ? Number(link.revSharePercent) : null;
        const candidates = linkAcceptsVisitor(link, matchable)
          ? await buildCandidates(members, matchable, linkRevShare)
          : [];
        if (candidates.length === 0) {
          if (!link.fallbackUrl) {
            throw new NotFoundError('No offer available for this smart-link');
          }
          return { redirectUrl: link.fallbackUrl, clickId, clickRefId };
        }
        const chosen = await pickCandidate(link, candidates);
        offer = chosen.offer;
        uniquenessKey = offer.id;
        // The rotation already resolved this click's rule; re-resolving it below could
        // pick a different one and price the redirect differently from the offer that
        // was chosen on the strength of that price.
        preMatchedRule = chosen.rule;
        smartLinkId = link.id;
        smartLinkDestinationUrl = link.destinationUrl;
        smartLinkBlockedRedirectUrl = link.blockedRedirectUrl;
        revSharePercent = link.revSharePercent != null ? Number(link.revSharePercent) : null;
      }
    }

    // One Redis round-trip, alongside the proxy check that may already have made an
    // external HTTP call — this adds nothing meaningful to the hot path.
    const isUnique = await isFirstClick(uniquenessKey, req.ip);

    // Fire-and-forget: the redirect must not wait on this write. A full batched-flush
    // buffer (Redis/queue) is the production version of this — see PLAN-tracker.md;
    // this direct insert is the correctness-first version for now.
    clickRepository
      .create({
        id: clickId,
        refId: clickRefId,
        offerId: offer?.id ?? null,
        affiliateId,
        smartLinkId,
        ip: req.ip,
        userAgent: req.userAgent,
        // Every geo field the lookup resolved, not a chosen few — the City record was
        // decoded in full either way, so narrowing here would only discard what we
        // already paid to read. `isPrivateIp` is the one field that stays out: it
        // describes the address, and the row already has `ip` to say the same thing.
        countryCode,
        countryName: geo.countryName,
        registeredCountryCode: geo.registeredCountryCode,
        continentCode: geo.continentCode,
        continentName: geo.continentName,
        city: geo.city,
        cityGeonameId: geo.cityGeonameId,
        region: geo.region,
        regionCode: geo.regionCode,
        region2: geo.region2,
        region2Code: geo.region2Code,
        postalCode: geo.postalCode,
        latitude: geo.latitude === null ? null : String(geo.latitude),
        longitude: geo.longitude === null ? null : String(geo.longitude),
        accuracyRadiusKm: geo.accuracyRadiusKm,
        timeZone: geo.timeZone,
        metroCode: geo.metroCode,
        asnNumber: geo.asnNumber,
        asnOrganization: geo.asnOrganization,
        isAnonymousProxy: geo.isAnonymousProxy,
        isSatelliteProvider: geo.isSatelliteProvider,
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
        // The rest of the same provider answer. Kept separate from the MaxMind columns
        // above on purpose — these are a second opinion, not a better one.
        proxyProvider: proxyVerdict?.provider ?? null,
        proxyBlock: proxyVerdict?.block ?? null,
        proxyHostname: proxyVerdict?.hostname ?? null,
        proxyIsp: proxyVerdict?.isp ?? null,
        proxyAsnNumber: proxyVerdict?.asnNumber ?? null,
        proxyCountryCode: proxyVerdict?.countryCode ?? null,
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
      // Most specific first — the offer, then the smart-link this click came through,
      // then the network-wide setting, then the built-in default. Some advertisers
      // require rejected traffic to land on their own "offer unavailable" page, and an
      // offer-less link has no offer to carry that instruction, so it carries its own.
      return {
        redirectUrl:
          offer?.blockedRedirectUrl?.trim() || smartLinkBlockedRedirectUrl?.trim() || settings.blockedRedirectUrl,
        clickId,
        clickRefId,
      };
    }

    // Issue #15: route by the offer's own geo/device/OS targeting. A rule with empty
    // targeting (the common case today) matches everything, so this is a no-op for
    // every offer that hasn't configured targeting — only a genuinely non-matching
    // click (one that fits none of the offer's targeted rules) falls through to
    // fallbackUrl instead of destinationUrl.
    //
    // An offer-less link has no rules to route by and no offer destination to fall back
    // to — its address is the link's own, and what the click is worth is not knowable
    // until the advertiser reports the sale. `{payout_amount}` is therefore empty rather
    // than a guess, while `{click_id}` is real: the row above exists, and it is what a
    // postback matches on to price the conversion against this link's revenue share.
    if (!offer) {
      return {
        redirectUrl: memberlessDestination!
          .replace('{click_id}', String(clickRefId))
          .replace('{payout_amount}', ''),
        clickId,
        clickRefId,
      };
    }

    // A smart-link click already has its rule from the rotation, so this is skipped
    // there rather than resolved a second time.
    const matchedRule = preMatchedRule ?? (await findMatchingRuleForClick(offer.payoutRules, matchable));

    if (!matchedRule) {
      const fallback = offer.fallbackUrl?.trim() || offer.destinationUrl!;
      return {
        redirectUrl: fallback.replace('{click_id}', String(clickRefId)).replace('{payout_amount}', ''),
        clickId,
        clickRefId,
      };
    }

    const { payoutAmount } = computeAmounts(matchedRule, revSharePercent);

    // A smart-link may override where its traffic lands. The member offer is still
    // chosen, logged and paid against — only the address changes — so a network that
    // routes all rotator traffic through its own page keeps correct attribution.
    // Unset (the normal case) falls through to the chosen offer's own destination.
    const destination = smartLinkDestinationUrl?.trim() || offer.destinationUrl!;
    return {
      redirectUrl: destination
        .replace('{click_id}', String(clickRefId))
        .replace('{payout_amount}', payoutAmount.toFixed(2)),
      clickId,
      clickRefId,
    };
  },
};
