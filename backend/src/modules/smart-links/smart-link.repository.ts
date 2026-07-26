import { AppDataSource } from '../../infra/database/data-source';
import { SmartLink } from './smart-link.entity';
import type { SmartLinkFiltersDto } from './smart-link.dto';

const repository = AppDataSource.getRepository(SmartLink);

export const smartLinkRepository = {
  findAll(filters: SmartLinkFiltersDto): Promise<SmartLink[]> {
    const qb = repository.createQueryBuilder('link');
    if (filters.status) {
      qb.andWhere('link.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere('(link.name ILIKE :search OR link.slug ILIKE :search)', { search: `%${filters.search}%` });
    }
    return qb.orderBy('link."createdAt"', 'DESC').getMany();
  },

  findById(id: string): Promise<SmartLink | null> {
    return repository.findOne({ where: { id } });
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

  async delete(id: string): Promise<void> {
    await repository.delete({ id });
  },
};
