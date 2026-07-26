import type { SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { Click, ClickQualityStatus } from '../clicks/click.entity';
import { Conversion, ConversionStatus } from '../conversions/conversion.entity';
import type { ReportDimension, ReportFiltersDto } from './report.dto';

/**
 * Aggregation lives here rather than in the service because every report is a GROUP BY
 * over clicks and conversions, and those two tables are the ones that grow without
 * bound — the counting must happen in Postgres, never by loading rows into Node.
 *
 * Clicks and conversions are aggregated as two separate grouped queries and merged by
 * key in the service. A single FULL OUTER JOIN would be one round-trip but makes the
 * WHERE clauses ambiguous (a date filter would have to apply to both sides at once),
 * and the merge is over grouped rows — a few hundred at most, not raw traffic.
 */

// SQL expression each dimension groups by, per source table.
const CLICK_DIMENSION: Record<ReportDimension, string> = {
  date: `to_char(click."createdAt", 'YYYY-MM-DD')`,
  offer: 'click."offerId"::text',
  affiliate: 'click."affiliateId"::text',
  advertiser: 'offer."advertiserId"::text',
  country: 'click."countryCode"',
  city: 'click."city"',
  device: 'click."deviceType"',
  os: 'click."os"',
  browser: 'click."browser"',
  subId1: 'click."subId1"',
  subId2: 'click."subId2"',
  subId3: 'click."subId3"',
  subId4: 'click."subId4"',
  subId5: 'click."subId5"',
  subId6: 'click."subId6"',
  subId7: 'click."subId7"',
  subId8: 'click."subId8"',
};

const CONVERSION_DIMENSION: Record<ReportDimension, string> = {
  date: `to_char(conversion."createdAt", 'YYYY-MM-DD')`,
  offer: 'conversion."offerId"::text',
  affiliate: 'conversion."affiliateId"::text',
  advertiser: 'offer."advertiserId"::text',
  country: 'conversion."countryCode"',
  // City is not denormalised onto the conversion, so it comes via the click join.
  city: 'click."city"',
  device: 'click."deviceType"',
  os: 'click."os"',
  browser: 'click."browser"',
  subId1: 'conversion."subId1"',
  subId2: 'conversion."subId2"',
  subId3: 'conversion."subId3"',
  subId4: 'conversion."subId4"',
  subId5: 'conversion."subId5"',
  subId6: 'conversion."subId6"',
  subId7: 'conversion."subId7"',
  subId8: 'conversion."subId8"',
};

// Dimensions that only exist on the click row, so a conversion has to reach them
// through the click it came from.
const NEEDS_CLICK_JOIN: ReportDimension[] = ['device', 'os', 'browser', 'city'];
const NEEDS_OFFER_JOIN: ReportDimension[] = ['advertiser'];

export interface ClickAggregateRow {
  key: string | null;
  clicks: string;
  uniqueClicks: string;
  blockedClicks: string;
  suspectClicks: string;
}

export interface ConversionAggregateRow {
  key: string | null;
  conversions: string;
  approved: string;
  rejected: string;
  revenue: string | null;
  payout: string | null;
}

function applyClickFilters(qb: SelectQueryBuilder<Click>, filters: ReportFiltersDto, joinedOffer: boolean): void {
  if (filters.dateFrom) {
    qb.andWhere('click."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
  }
  if (filters.dateTo) {
    qb.andWhere('click."createdAt" <= :dateTo', { dateTo: filters.dateTo });
  }
  if (filters.offerId) {
    qb.andWhere('click."offerId" = :offerId', { offerId: filters.offerId });
  }
  if (filters.affiliateId) {
    qb.andWhere('click."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
  }
  if (filters.countryCode) {
    qb.andWhere('click."countryCode" = :countryCode', { countryCode: filters.countryCode });
  }
  if (filters.advertiserId && joinedOffer) {
    qb.andWhere('offer."advertiserId" = :advertiserId', { advertiserId: filters.advertiserId });
  }
}

function applyConversionFilters(
  qb: SelectQueryBuilder<Conversion>,
  filters: ReportFiltersDto,
  joinedOffer: boolean,
): void {
  if (filters.dateFrom) {
    qb.andWhere('conversion."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
  }
  if (filters.dateTo) {
    qb.andWhere('conversion."createdAt" <= :dateTo', { dateTo: filters.dateTo });
  }
  if (filters.offerId) {
    qb.andWhere('conversion."offerId" = :offerId', { offerId: filters.offerId });
  }
  if (filters.affiliateId) {
    qb.andWhere('conversion."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
  }
  if (filters.countryCode) {
    qb.andWhere('conversion."countryCode" = :countryCode', { countryCode: filters.countryCode });
  }
  if (filters.advertiserId && joinedOffer) {
    qb.andWhere('offer."advertiserId" = :advertiserId', { advertiserId: filters.advertiserId });
  }
}

export const reportRepository = {
  clickAggregates(dimension: ReportDimension, filters: ReportFiltersDto): Promise<ClickAggregateRow[]> {
    const expression = CLICK_DIMENSION[dimension];
    const needsOffer = NEEDS_OFFER_JOIN.includes(dimension) || Boolean(filters.advertiserId);

    const qb = AppDataSource.getRepository(Click).createQueryBuilder('click');
    if (needsOffer) {
      qb.innerJoin('offers', 'offer', 'offer.id = click."offerId"');
    }

    qb.select(expression, 'key')
      .addSelect('COUNT(*)', 'clicks')
      // Counts the stored per-row flag rather than DISTINCT ip, so this aggregate and
      // the Yes/No badge on the click log share one definition of "unique" (first
      // click for an offer from an IP within 24h — see clicks/unique-click.ts).
      // DISTINCT ip meant "ever", which no per-row badge could have reproduced.
      .addSelect(`COUNT(*) FILTER (WHERE click."isUnique")`, 'uniqueClicks')
      .addSelect(`COUNT(*) FILTER (WHERE click."qualityStatus" = :blocked)`, 'blockedClicks')
      .addSelect(`COUNT(*) FILTER (WHERE click."qualityStatus" = :suspect)`, 'suspectClicks')
      .setParameters({ blocked: ClickQualityStatus.BLOCKED, suspect: ClickQualityStatus.SUSPECT });

    applyClickFilters(qb, filters, needsOffer);

    return qb.groupBy(expression).getRawMany<ClickAggregateRow>();
  },

  conversionAggregates(dimension: ReportDimension, filters: ReportFiltersDto): Promise<ConversionAggregateRow[]> {
    const expression = CONVERSION_DIMENSION[dimension];
    const needsOffer = NEEDS_OFFER_JOIN.includes(dimension) || Boolean(filters.advertiserId);
    const needsClick = NEEDS_CLICK_JOIN.includes(dimension);

    const qb = AppDataSource.getRepository(Conversion).createQueryBuilder('conversion');
    if (needsOffer) {
      qb.innerJoin('offers', 'offer', 'offer.id = conversion."offerId"');
    }
    if (needsClick) {
      // LEFT, not INNER: an orphan conversion has no click, and dropping it here would
      // make the report's conversion count disagree with the conversions page.
      qb.leftJoin('clicks', 'click', 'click.id = conversion."clickId"');
    }

    qb.select(expression, 'key')
      .addSelect('COUNT(*)', 'conversions')
      .addSelect(`COUNT(*) FILTER (WHERE conversion.status IN (:...approvedStates))`, 'approved')
      .addSelect(`COUNT(*) FILTER (WHERE conversion.status = :rejected)`, 'rejected')
      .addSelect('SUM(conversion."revenueAmount")', 'revenue')
      .addSelect('SUM(conversion."payoutAmount")', 'payout')
      .setParameters({
        // PAID conversions were approved first — counting only APPROVED would make
        // historical rows appear to un-approve themselves once they were paid out.
        approvedStates: [ConversionStatus.APPROVED, ConversionStatus.PAID],
        rejected: ConversionStatus.REJECTED,
      });

    applyConversionFilters(qb, filters, needsOffer);

    return qb.groupBy(expression).getRawMany<ConversionAggregateRow>();
  },
};
