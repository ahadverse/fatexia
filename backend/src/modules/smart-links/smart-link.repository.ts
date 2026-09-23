import { AppDataSource } from '../../infra/database/data-source';
import { SmartLink } from './smart-link.entity';
import type { SmartLinkFiltersDto } from './smart-link.dto';

const repository = AppDataSource.getRepository(SmartLink);

export const smartLinkRepository = {
  findAll(filters: SmartLinkFiltersDto): Promise<SmartLink[]> {
    // Caps are joined rather than fetched per row: the list renders them, and a link
    // has at most a handful, so this stays one query instead of N.
    const qb = repository.createQueryBuilder('link').leftJoinAndSelect('link.caps', 'caps');
    if (filters.status) {
      qb.andWhere('link.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere('(link.name ILIKE :search OR link.slug ILIKE :search)', { search: `%${filters.search}%` });
    }
    return qb.orderBy('link."createdAt"', 'DESC').getMany();
  },

  findById(id: string): Promise<SmartLink | null> {
    return repository.findOne({ where: { id }, relations: ['caps'] });
  },

  findBySlug(slug: string): Promise<SmartLink | null> {
    return repository.findOne({ where: { slug } });
  },

  create(data: Partial<SmartLink>): Promise<SmartLink> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<SmartLink>): Promise<void> {
    await repository.update({ id }, fields);
  },

  // Stamped on the first postback that authenticates with the link's own credentials,
  // so an operator can tell a configured integration from a merely saved one. Same
  // role as offerRepository.markPostbackVerified.
  async markPostbackVerified(id: string): Promise<void> {
    await repository.update({ id }, { postbackVerifiedAt: new Date() });
  },

  async delete(id: string): Promise<void> {
    await repository.delete({ id });
  },
};
