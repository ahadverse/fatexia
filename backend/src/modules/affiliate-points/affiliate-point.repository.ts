import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { AffiliatePoint } from './affiliate-point.entity';
import type { PointFiltersDto } from './affiliate-point.dto';

const repository = AppDataSource.getRepository(AffiliatePoint);

export interface PointBalanceRow {
  affiliateId: string;
  totalPoints: string;
  entryCount: string;
}

export const affiliatePointRepository = {
  findAll(filters: PointFiltersDto): Promise<[AffiliatePoint[], number]> {
    const qb = repository.createQueryBuilder('point');
    if (filters.affiliateId) {
      qb.andWhere('point."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
    }
    if (filters.dateFrom) {
      qb.andWhere('point."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('point."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }
    return qb
      .orderBy('point."createdAt"', 'DESC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  // Grouped in SQL rather than summed in JS — the ledger is append-only and grows
  // without bound, so the leaderboard must never load every row to add them up.
  balances(): Promise<PointBalanceRow[]> {
    return repository
      .createQueryBuilder('point')
      .select('point."affiliateId"', 'affiliateId')
      .addSelect('SUM(point.points)', 'totalPoints')
      .addSelect('COUNT(*)', 'entryCount')
      .groupBy('point."affiliateId"')
      .orderBy('SUM(point.points)', 'DESC')
      .getRawMany<PointBalanceRow>();
  },

  create(data: Partial<AffiliatePoint>): Promise<AffiliatePoint> {
    return repository.save(repository.create(data));
  },
};
