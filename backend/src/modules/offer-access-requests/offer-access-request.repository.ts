import { AppDataSource } from '../../infra/database/data-source';
import { OfferAccessRequest } from './offer-access-request.entity';
import type { AccessRequestFiltersDto } from './offer-access-request.dto';

const repository = AppDataSource.getRepository(OfferAccessRequest);

export const offerAccessRequestRepository = {
  findAll(filters: AccessRequestFiltersDto): Promise<OfferAccessRequest[]> {
    const qb = repository.createQueryBuilder('request');
    if (filters.status) {
      qb.andWhere('request.status = :status', { status: filters.status });
    }
    if (filters.offerId) {
      qb.andWhere('request."offerId" = :offerId', { offerId: filters.offerId });
    }
    if (filters.affiliateId) {
      qb.andWhere('request."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
    }
    return qb.orderBy('request."createdAt"', 'DESC').getMany();
  },

  findById(id: string): Promise<OfferAccessRequest | null> {
    return repository.findOne({ where: { id } });
  },

  findByPair(offerId: string, affiliateId: string): Promise<OfferAccessRequest | null> {
    return repository.findOne({ where: { offerId, affiliateId } });
  },

  save(data: Partial<OfferAccessRequest>): Promise<OfferAccessRequest> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<OfferAccessRequest>): Promise<void> {
    await repository.update({ id }, fields);
  },
};
