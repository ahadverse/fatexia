import { randomUUID } from 'node:crypto';
import { UAParser } from 'ua-parser-js';
import { NotFoundError } from '../../common/errors';
import { logger } from '../../common/logger';
import { offerRepository } from '../offers/offer.repository';
import { OfferStatus } from '../offers/offer.entity';
import { geoSource } from '../geo-source/geo-source';
import { isLikelyDatacenter } from '../fraud/datacenter-filter';
import { checkResidentialProxy } from '../fraud/proxy-detection';
import { getTrackerSettings } from '../network-settings/tracker-settings';
import { clickRepository } from './click.repository';
import { ClickQualityStatus } from './click.entity';
import { isFirstClick } from './unique-click';

export interface ClickRequest {
  offerId: string;
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

export const clickService = {
  async handleClick(req: ClickRequest): Promise<ClickResult> {
    // Single indexed PK read — the one synchronous DB read on this hot path (see
    // PLAN-tracker.md performance requirements).
    const offer = await offerRepository.findById(req.offerId);
    if (!offer || offer.status !== OfferStatus.APPROVED || !offer.destinationUrl) {
      throw new NotFoundError('Offer not available');
    }

    const clickId = randomUUID();

    // Fraud signals: datacenter/geo are always-on local lookups (no external call);
    // the residential-proxy check is best-effort and may resolve to null (see
    // proxy-detection.ts) — none of this blocks the redirect below.
    const settings = await getTrackerSettings();

    const { asn, countryCode, city, region, regionCode } = await geoSource.lookup(req.ip);
    const isDatacenter = isLikelyDatacenter(asn);
    const isProxyOrVpn = await checkResidentialProxy(req.ip);
    const { riskScore, qualityStatus } = scoreClick(isDatacenter, isProxyOrVpn, settings);

    // One Redis round-trip, alongside the proxy check that may already have made an
    // external HTTP call — this adds nothing meaningful to the hot path.
    const isUnique = await isFirstClick(offer.id, req.ip);

    const ua = req.userAgent ? UAParser(req.userAgent) : null;

    // Fire-and-forget: the redirect must not wait on this write. A full batched-flush
    // buffer (Redis/queue) is the production version of this — see PLAN-tracker.md;
    // this direct insert is the correctness-first version for now.
    clickRepository
      .create({
        id: clickId,
        offerId: offer.id,
        affiliateId: req.affiliateId,
        ip: req.ip,
        userAgent: req.userAgent,
        countryCode,
        city,
        region,
        regionCode,
        // UAParser already returns the vendor and both version strings — the previous
        // version parsed them and then dropped them on the floor.
        deviceType: ua?.device.type ?? null,
        deviceBrand: ua?.device.vendor ?? null,
        os: ua?.os.name ?? null,
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

    return { redirectUrl: offer.destinationUrl.replace('{click_id}', clickId), clickId };
  },
};
