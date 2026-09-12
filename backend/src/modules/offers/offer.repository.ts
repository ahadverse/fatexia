import { In } from 'typeorm';
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

  /**
   * A smart-link's candidate members, in one query on the click hot path.
   *
   * Filtering to APPROVED here rather than in the resolver is deliberate: a member
   * that was paused after being added to the link must drop out of the rotation
   * immediately, and doing that in SQL means a paused offer never even reaches the
   * selection code where it could be picked by mistake.
   */
  findApprovedByIdsWithPayoutRules(ids: string[]): Promise<Offer[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return repository.find({
      where: { id: In(ids), status: OfferStatus.APPROVED },
      relations: ['payoutRules'],
    });
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
  //
  // Gating (issue #19): a public offer (isPublic=true) is visible to every affiliate.
  // A gated offer only shows up once this specific affiliate has an APPROVED row in
  // offer_access_requests — joined in raw (not via the entity relation, which would
  // create a circular module dependency between offers and offer-access-requests).
  findAvailableForAffiliate(affiliateId: string): Promise<Offer[]> {
    return repository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.payoutRules', 'payoutRules')
      .leftJoinAndSelect('offer.caps', 'caps')
      .leftJoinAndSelect('offer.advertiser', 'advertiser')
      .leftJoin(
        // Lowercase alias, deliberately: TypeORM quotes whatever alias string it's
        // given (e.g. `"accessreq"`), and Postgres case-folds an *unquoted* identifier
        // in a later raw andWhere to lowercase — a camelCase alias would mismatch its
        // own join and fail with "missing FROM-clause entry".
        'offer_access_requests',
        'accessreq',
        'accessreq."offerId" = offer.id AND accessreq."affiliateId" = :affiliateId AND accessreq.status = :approvedStatus',
        { affiliateId, approvedStatus: 'APPROVED' },
      )
      .andWhere('offer.status = :status', { status: OfferStatus.APPROVED })
      // Three ways an affiliate reaches an offer: it is public, they were granted
      // access, or a payout rule names them.
      //
      // That last one was missing. "Dedicate to affiliate(s)" on a payout rule set who
      // the rule prices for, but not who could see the offer — so dedicating a private
      // offer to someone hid it from them, which is the opposite of what the field
      // reads as. EXISTS against the rules rather than a join, so an offer with several
      // dedicated rules is still returned once.
      .andWhere(
        `(
          offer."isPublic" = true
          OR accessreq.id IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM payout_rules dedicated
             WHERE dedicated."offerId" = offer.id
               AND dedicated.targeting->'affiliateIds' @> :affiliateIdJson::jsonb
          )
        )`,
        { affiliateIdJson: JSON.stringify([affiliateId]) },
      )
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
