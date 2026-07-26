import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { PostbackLog } from './postback-log.entity';
import type { PostbackLogFiltersDto } from './postback-log.dto';

const repository = AppDataSource.getRepository(PostbackLog);

export const postbackLogRepository = {
  findAll(filters: PostbackLogFiltersDto): Promise<[PostbackLog[], number]> {
    const qb = repository.createQueryBuilder('log');
    if (filters.direction) {
      qb.andWhere('log.direction = :direction', { direction: filters.direction });
    }
    if (filters.offerId) {
      qb.andWhere('log."offerId" = :offerId', { offerId: filters.offerId });
    }
    if (filters.affiliateId) {
      qb.andWhere('log."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
    }
    if (filters.conversionId) {
      qb.andWhere('log."conversionId" = :conversionId', { conversionId: filters.conversionId });
    }
    if (filters.success !== undefined) {
      qb.andWhere('log.success = :success', { success: filters.success });
    }
    if (filters.dateFrom) {
      qb.andWhere('log."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('log."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }
    return qb
      .orderBy('log."createdAt"', 'DESC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  create(data: Partial<PostbackLog>): Promise<PostbackLog> {
    return repository.save(repository.create(data));
  },
};
