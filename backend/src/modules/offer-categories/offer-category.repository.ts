import { AppDataSource } from '../../infra/database/data-source';
import { OfferCategory } from './offer-category.entity';

const repository = AppDataSource.getRepository(OfferCategory);

export const offerCategoryRepository = {
  findAll(): Promise<OfferCategory[]> {
    return repository.find({ order: { name: 'ASC' } });
  },

  findByName(name: string): Promise<OfferCategory | null> {
    return repository.findOne({ where: { name } });
  },

  create(name: string): Promise<OfferCategory> {
    return repository.save(repository.create({ name }));
  },

  delete(id: string): Promise<void> {
    return repository.delete({ id }).then(() => undefined);
  },
};
