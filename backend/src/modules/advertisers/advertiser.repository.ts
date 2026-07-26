import { AppDataSource } from '../../infra/database/data-source';
import { Offer } from '../offers/offer.entity';
import { Advertiser } from './advertiser.entity';
import type { AdvertiserFiltersDto } from './advertiser.dto';

const repository = AppDataSource.getRepository(Advertiser);

export interface AdvertiserOfferCountRow {
  advertiserId: string;
  count: string;
}

export const advertiserRepository = {
  findAll(filters: AdvertiserFiltersDto = {}): Promise<Advertiser[]> {
    const qb = repository.createQueryBuilder('advertiser');
    if (filters.status) {
      qb.andWhere('advertiser.status = :status', { status: filters.status });
    }
    if (filters.country) {
      qb.andWhere('advertiser.country = :country', { country: filters.country });
    }
    if (filters.accountManagerId) {
      qb.andWhere('advertiser."accountManagerId" = :accountManagerId', {
        accountManagerId: filters.accountManagerId,
      });
    }
    if (filters.search) {
      qb.andWhere('(advertiser.name ILIKE :search OR advertiser."contactEmail" ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }
    return qb.orderBy('advertiser.name', 'ASC').getMany();
  },

  findById(id: string): Promise<Advertiser | null> {
    return repository.findOne({ where: { id } });
  },

  findByName(name: string): Promise<Advertiser | null> {
    return repository.findOne({ where: { name } });
  },

  // One grouped query for the whole list, not a count per advertiser.
  offerCounts(): Promise<AdvertiserOfferCountRow[]> {
    return AppDataSource.getRepository(Offer)
      .createQueryBuilder('offer')
      .select('offer."advertiserId"', 'advertiserId')
      .addSelect('COUNT(*)', 'count')
      .groupBy('offer."advertiserId"')
      .getRawMany<AdvertiserOfferCountRow>();
  },

  create(data: Partial<Advertiser>): Promise<Advertiser> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<Advertiser>): Promise<void> {
    await repository.update({ id }, fields);
  },
};
