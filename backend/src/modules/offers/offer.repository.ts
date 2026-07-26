import { AppDataSource } from '../../infra/database/data-source';
import { Offer, OfferStatus } from './offer.entity';
import type { OfferFiltersDto } from './offer.dto';

const repository = AppDataSource.getRepository(Offer);

export const offerRepository = {
  findById(id: string): Promise<Offer | null> {
    return repository.findOne({ where: { id } });
  },

  // One query, no N+1 — the future conversions module needs the offer's payout
  // rules loaded to match one at conversion time.
  findByIdWithPayoutRules(id: string): Promise<Offer | null> {
    return repository.findOne({ where: { id }, relations: ['payoutRules'] });
  },

  findByIdWithChildren(id: string): Promise<Offer | null> {
    return repository.findOne({ where: { id }, relations: ['payoutRules', 'caps'] });
  },

  findAll(filters: OfferFiltersDto): Promise<Offer[]> {
    const qb = repository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.payoutRules', 'payoutRules')
      .leftJoinAndSelect('offer.caps', 'caps');
    if (filters.advertiserId) {
      qb.andWhere('offer."advertiserId" = :advertiserId', { advertiserId: filters.advertiserId });
    }
    if (filters.status) {
      qb.andWhere('offer.status = :status', { status: filters.status });
    }
    if (filters.category) {
      qb.andWhere('offer.category = :category', { category: filters.category });
    }
    if (filters.trafficType) {
      qb.andWhere(`offer."trafficTypes" @> :trafficType`, {
        trafficType: JSON.stringify([filters.trafficType]),
      });
    }
    if (filters.dateFrom) {
      qb.andWhere('offer."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('offer."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }
    return qb.orderBy('offer."createdAt"', 'DESC').getMany();
  },

  // Affiliate offer browse: APPROVED offers only, with the advertiser joined so the
  // DTO can denormalize advertiserName (affiliates can't call the admin-only
  // /advertisers API). One query, no N+1.
  findAvailableForAffiliate(): Promise<Offer[]> {
    return repository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.payoutRules', 'payoutRules')
      .leftJoinAndSelect('offer.caps', 'caps')
      .leftJoinAndSelect('offer.advertiser', 'advertiser')
      .andWhere('offer.status = :status', { status: OfferStatus.APPROVED })
      .orderBy('offer."createdAt"', 'DESC')
      .getMany();
  },

  async updateStatus(id: string, status: OfferStatus): Promise<Offer | null> {
    await repository.update({ id }, { status });
    return this.findByIdWithChildren(id);
  },

  async updatePostbackCredentials(
    id: string,
    fields: { postbackSecret: string; allowedPostbackIps?: string | null },
  ): Promise<void> {
    await repository.update({ id }, fields);
  },

  async markPostbackVerified(id: string, at: Date): Promise<void> {
    await repository.update({ id }, { postbackVerifiedAt: at });
  },
};
