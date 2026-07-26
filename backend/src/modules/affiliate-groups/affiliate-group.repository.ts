import { AppDataSource } from '../../infra/database/data-source';
import { AffiliateGroup } from './affiliate-group.entity';

const repository = AppDataSource.getRepository(AffiliateGroup);

export const affiliateGroupRepository = {
  findAll(): Promise<AffiliateGroup[]> {
    return repository.find({ order: { name: 'ASC' } });
  },

  findById(id: string): Promise<AffiliateGroup | null> {
    return repository.findOne({ where: { id } });
  },

  findByName(name: string): Promise<AffiliateGroup | null> {
    return repository.findOne({ where: { name } });
  },

  create(data: Partial<AffiliateGroup>): Promise<AffiliateGroup> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<AffiliateGroup>): Promise<void> {
    await repository.update({ id }, fields);
  },

  async delete(id: string): Promise<void> {
    await repository.delete({ id });
  },
};
