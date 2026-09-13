import { In, type SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { applyManagerScope } from '../../common/manager-scope-sql';
import { isRefId, isUuid } from '../../common/ref-id';
import { Click } from './click.entity';
import type { ClickLogFiltersDto, ClickSortField, ClickSummaryDto } from './click.dto';

const repository = AppDataSource.getRepository(Click);

// The sort key never reaches SQL as text — it selects a fixed expression from here.
const SORT_COLUMN: Record<ClickSortField, string> = {
  createdAt: 'click."createdAt"',
  ip: 'click.ip',
  countryCode: 'click."countryCode"',
  isUnique: 'click."isUnique"',
};

/**
 * Every filter, applied once.
 *
 * The list and the summary must agree — a tile reading "2,406 clicks" above a table
 * filtered to something else is worse than no tile at all — so they share this builder
 * rather than each maintaining their own copy of the WHERE clause.
 */
function applyFilters(qb: SelectQueryBuilder<Click>, filters: ClickLogFiltersDto): SelectQueryBuilder<Click> {
  if (filters.offerId) {
    qb.andWhere('click."offerId" = :offerId', { offerId: filters.offerId });
  }
  if (filters.affiliateId) {
    qb.andWhere('click."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
  }
  applyManagerScope(qb, 'click', filters.managerScopeId);
  if (filters.qualityStatus) {
    qb.andWhere('click."qualityStatus" = :qualityStatus', { qualityStatus: filters.qualityStatus });
  }
  if (filters.countryCode) {
    qb.andWhere('click."countryCode" = :countryCode', { countryCode: filters.countryCode });
  }
  if (filters.subId1) {
    qb.andWhere('click."subId1" = :subId1', { subId1: filters.subId1 });
  }
  if (filters.dateFrom) {
    qb.andWhere('click."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
  }
  if (filters.dateTo) {
    qb.andWhere('click."createdAt" <= :dateTo', { dateTo: filters.dateTo });
  }
  return qb;
}

export const clickRepository = {
  create(data: Partial<Click>): Promise<Click> {
    return repository.save(repository.create(data));
  },

  findById(id: string): Promise<Click | null> {
    return repository.findOne({ where: { id } });
  },

  /**
   * The click a postback names, by whichever id the advertiser sends back.
   *
   * `{click_id}` on the destination URL is now the short `refId`, but an advertiser's
   * platform stores whatever it was handed at click time and posts that back later —
   * possibly weeks later. Clicks that went out before this change carry the uuid, and
   * their conversions still have to match, so both are accepted for as long as those
   * clicks can still convert.
   */
  findByPostbackId(clickId: string): Promise<Click | null> {
    if (isRefId(clickId)) return repository.findOne({ where: { refId: Number(clickId) } });
    // Guarded: the column is `uuid`, and Postgres errors on a malformed one rather than
    // returning no rows — which would turn a junk postback into a 500 instead of the
    // orphan conversion it should be recorded as.
    if (!isUuid(clickId)) return Promise.resolve(null);
    return repository.findOne({ where: { id: clickId } });
  },

  /**
   * uuid → the short number for a page of clicks, in one query.
   *
   * A conversion stores the click's uuid, but every screen that shows a conversion
   * wants the number the advertiser actually saw and posted back — that is the value
   * someone quotes when a conversion is disputed. Resolved per page rather than
   * denormalized onto the conversion row, which would be a second copy of a value that
   * already exists.
   */
  async refIdsByIds(ids: string[]): Promise<Map<string, number>> {
    const unique = [...new Set(ids)];
    if (unique.length === 0) return new Map();
    const rows = await repository.find({ where: { id: In(unique) }, select: ['id', 'refId'] });
    return new Map(rows.map((row) => [row.id, row.refId]));
  },

  findLogs(filters: ClickLogFiltersDto): Promise<[Click[], number]> {
    const qb = applyFilters(repository.createQueryBuilder('click'), filters);
    return qb
      .orderBy(SORT_COLUMN[filters.sortBy], filters.sortDir)
      // Ties on a low-cardinality sort (country, unique) would otherwise page
      // non-deterministically — the same row could appear on two pages.
      .addOrderBy('click.id', 'ASC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  // Totals for the stat tiles. One grouped query rather than loading rows into Node —
  // the filtered set can be millions of clicks.
  async summarize(filters: ClickLogFiltersDto): Promise<ClickSummaryDto> {
    const row = await applyFilters(repository.createQueryBuilder('click'), filters)
      .select('COUNT(*)', 'clicks')
      .addSelect('COUNT(*) FILTER (WHERE click."isUnique")', 'uniqueClicks')
      .getRawOne<{ clicks: string; uniqueClicks: string }>();

    return { clicks: Number(row?.clicks ?? 0), uniqueClicks: Number(row?.uniqueClicks ?? 0) };
  },

  // Countries that actually have traffic, for the country filter dropdown — listing
  // all 200-odd ISO codes when only 11 appear in the data is just noise.
  async distinctCountries(affiliateId?: string): Promise<string[]> {
    const qb = repository
      .createQueryBuilder('click')
      .select('DISTINCT click."countryCode"', 'countryCode')
      .where('click."countryCode" IS NOT NULL');
    if (affiliateId) {
      qb.andWhere('click."affiliateId" = :affiliateId', { affiliateId });
    }
    const rows = await qb.orderBy('click."countryCode"', 'ASC').getRawMany<{ countryCode: string }>();
    return rows.map((row) => row.countryCode);
  },
};
