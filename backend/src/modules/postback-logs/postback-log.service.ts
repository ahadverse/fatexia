import { paginate, type Paginated } from '../../common/pagination';
import { affiliateNames, offerNames } from '../../common/entity-names';
import { postbackLogRepository } from './postback-log.repository';
import { toPostbackLogDto, type PostbackLogDto, type PostbackLogFiltersDto } from './postback-log.dto';

export const postbackLogService = {
  async getLogs(filters: PostbackLogFiltersDto): Promise<Paginated<PostbackLogDto>> {
    const [rows, total] = await postbackLogRepository.findAll(filters);

    const [offers, affiliates] = await Promise.all([
      offerNames(rows.flatMap((r) => (r.offerId ? [r.offerId] : []))),
      affiliateNames(rows.flatMap((r) => (r.affiliateId ? [r.affiliateId] : []))),
    ]);

    const dtos = rows.map((row) =>
      toPostbackLogDto(row, {
        offerName: row.offerId ? (offers.get(row.offerId) ?? null) : null,
        affiliateName: row.affiliateId ? (affiliates.get(row.affiliateId) ?? null) : null,
      }),
    );

    return paginate(dtos, total, filters);
  },
};
