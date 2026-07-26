import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames, offerNames } from '../../common/entity-names';
import { isPrivateOrLoopback } from '../geo-source/geo-source';
import { affiliateService } from '../affiliates/affiliate.service';
import { clickRepository } from './click.repository';
import type { ClickLogDto, ClickLogFiltersDto, ClickSummaryDto } from './click.dto';
import type { Click } from './click.entity';

// The admin read side of the clicks table. Kept separate from click.service.ts, which
// is the Tracker's hot write path and must not grow reporting concerns.
export interface ClickLogRow extends ClickLogDto {
  offerName: string | null;
  affiliateName: string | null;
}

export interface ClickLogResult<T> extends Paginated<T> {
  summary: ClickSummaryDto;
}

/**
 * One human-readable location string.
 *
 * A click that resolved to nothing used to render as a bare "—", which reads as a bug
 * rather than as information. The three outcomes are genuinely different and the label
 * says which one happened: a real location, an address MaxMind deliberately has no
 * record for (every dev-machine click), or a public address that simply did not match.
 */
export function geoLabel(click: Pick<Click, 'countryCode' | 'city' | 'regionCode' | 'ip'>): string {
  if (click.countryCode) {
    return [click.city, click.regionCode, click.countryCode].filter(Boolean).join(', ');
  }
  return isPrivateOrLoopback(click.ip) ? 'Local network' : 'Unknown';
}

function toClickLogRow(click: Click, offerName: string | null, affiliateName: string | null): ClickLogRow {
  return {
    id: click.id,
    offerId: click.offerId,
    offerName,
    affiliateId: click.affiliateId,
    affiliateName,
    ip: click.ip,
    userAgent: click.userAgent,
    countryCode: click.countryCode,
    city: click.city,
    region: click.region,
    regionCode: click.regionCode,
    geoLabel: geoLabel(click),
    deviceType: click.deviceType,
    deviceBrand: click.deviceBrand,
    os: click.os,
    osVersion: click.osVersion,
    browser: click.browser,
    browserVersion: click.browserVersion,
    asn: click.asn,
    isDatacenter: click.isDatacenter,
    isProxyOrVpn: click.isProxyOrVpn,
    isUnique: click.isUnique,
    riskScore: click.riskScore,
    qualityStatus: click.qualityStatus,
    subId1: click.subId1,
    subId2: click.subId2,
    subId3: click.subId3,
    subId4: click.subId4,
    subId5: click.subId5,
    subId6: click.subId6,
    subId7: click.subId7,
    subId8: click.subId8,
    referer: click.referer,
    createdAt: click.createdAt.toISOString(),
  };
}

/**
 * Affiliate-facing click row.
 *
 * Narrower than the admin row on purpose. IP, user agent, geo and device detail are
 * the affiliate's own traffic and they need them to debug a source — those are shown.
 * What stays withheld is the network's *fraud reasoning*: the ASN, the datacenter and
 * proxy flags, the numeric risk score and the referer. Handing those over tells anyone
 * sending bad traffic exactly which signal caught them. The quality band is kept — an
 * affiliate does need to know traffic was rejected, just not precisely why.
 */
export interface OwnClickLogRow {
  id: string;
  offerId: string;
  offerName: string | null;
  ip: string;
  userAgent: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  regionCode: string | null;
  geoLabel: string;
  deviceType: string | null;
  deviceBrand: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  isUnique: boolean;
  qualityStatus: ClickLogDto['qualityStatus'];
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  subId5: string | null;
  subId6: string | null;
  subId7: string | null;
  subId8: string | null;
  createdAt: string;
}

export const clickLogService = {
  async getOwnLogs(userId: string, filters: ClickLogFiltersDto): Promise<ClickLogResult<OwnClickLogRow>> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    const scoped = { ...filters, affiliateId };

    const [[rows, total], summary] = await Promise.all([
      clickRepository.findLogs(scoped),
      clickRepository.summarize(scoped),
    ]);
    const offers = await offerNames(rows.map((row) => row.offerId));

    return {
      ...paginate(
        rows.map((row) => ({
          id: row.id,
          offerId: row.offerId,
          offerName: offers.get(row.offerId) ?? null,
          ip: row.ip,
          userAgent: row.userAgent,
          countryCode: row.countryCode,
          city: row.city,
          region: row.region,
          regionCode: row.regionCode,
          geoLabel: geoLabel(row),
          deviceType: row.deviceType,
          deviceBrand: row.deviceBrand,
          os: row.os,
          osVersion: row.osVersion,
          browser: row.browser,
          browserVersion: row.browserVersion,
          isUnique: row.isUnique,
          qualityStatus: row.qualityStatus,
          subId1: row.subId1,
          subId2: row.subId2,
          subId3: row.subId3,
          subId4: row.subId4,
          subId5: row.subId5,
          subId6: row.subId6,
          subId7: row.subId7,
          subId8: row.subId8,
          createdAt: row.createdAt.toISOString(),
        })),
        total,
        filters,
      ),
      summary,
    };
  },

  async getOwnCountries(userId: string): Promise<string[]> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    return clickRepository.distinctCountries(affiliateId);
  },

  async getCountries(): Promise<string[]> {
    return clickRepository.distinctCountries();
  },

  async getLogs(filters: ClickLogFiltersDto): Promise<ClickLogResult<ClickLogRow>> {
    const [[rows, total], summary] = await Promise.all([
      clickRepository.findLogs(filters),
      clickRepository.summarize(filters),
    ]);
    const [offers, affiliates] = await Promise.all([
      offerNames(rows.map((r) => r.offerId)),
      affiliateNames(rows.flatMap((r) => (r.affiliateId ? [r.affiliateId] : []))),
    ]);

    return {
      ...paginate(
        rows.map((row) =>
          toClickLogRow(
            row,
            offers.get(row.offerId) ?? null,
            row.affiliateId ? (affiliates.get(row.affiliateId) ?? null) : null,
          ),
        ),
        total,
        filters,
      ),
      summary,
    };
  },
};
