import type { SelectQueryBuilder } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { applyManagerScope } from '../../common/manager-scope-sql';
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
