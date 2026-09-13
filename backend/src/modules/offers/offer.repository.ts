import { In } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { isRefId } from '../../common/ref-id';
import { Offer, OfferStatus } from './offer.entity';
import { OfferFavourite } from './offer-favourite.entity';
import type { OfferFiltersDto } from './offer.dto';

const repository = AppDataSource.getRepository(Offer);
const favourites = AppDataSource.getRepository(OfferFavourite);

export const offerRepository = {
  findById(id: string): Promise<Offer | null> {
    return repository.findOne({ where: { id } });
  },

  // One query, no N+1 — the future conversions module needs the offer's payout
  // rules loaded to match one at conversion time.
  findByIdWithPayoutRules(id: string): Promise<Offer | null> {
    return repository.findOne({ where: { id }, relations: ['payoutRules'] });
  },

  /**
   * The same read, by whichever identifier the link carried.
   *
   * Tracking links now name an offer by its short `refId`, but every link already handed
   * out names it by uuid, and those have to keep redirecting — a tracking link is
   * pasted into ad platforms, chat messages and other people's systems, so it is not
   * something the network gets to reissue.
   */
  findForClick(identifier: string): Promise<Offer | null> {
    const where = isRefId(identifier) ? { refId: Number(identifier) } : { id: identifier };
    return repository.findOne({ where, relations: ['payoutRules'] });
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
    } else {
      // Delete is a soft delete — the row stays so historical clicks and conversions
      // keep resolving their offer. Without this the "deleted" offer never left the
      // list, which made the action look broken. Still reachable by filtering for
      // DELETED explicitly, which is the only way anyone would want to see one.
      qb.andWhere('offer.status != :deleted', { deleted: OfferStatus.DELETED });
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

  /**
   * Every live offer, gated or not — the affiliate browse list.
   *
   * Browse used to return only what the affiliate could already run, which meant a
   * gated offer was invisible to the person who would have to ask for it. They are
   * listed instead, and the DTO withholds the link and the brief until access is
   * granted (see toAffiliateOfferDto). Whether each one is granted is decided in the
   * service, from these rows plus findAccessRequestStatuses.
   *
   * The advertiser is joined so the DTO can denormalize advertiserName — affiliates
   * cannot call the admin-only /advertisers API. One query, no N+1.
   */
  findBrowsableForAffiliate(): Promise<Offer[]> {
    return repository
      .createQueryBuilder('offer')
      .leftJoinAndSelect('offer.payoutRules', 'payoutRules')
      .leftJoinAndSelect('offer.caps', 'caps')
      .leftJoinAndSelect('offer.advertiser', 'advertiser')
      .andWhere('offer.status = :status', { status: OfferStatus.APPROVED })
      .orderBy('offer."createdAt"', 'DESC')
      .getMany();
  },

  /**
   * This affiliate's access request per offer, as offerId -> status.
   *
   * Raw SQL rather than the offer-access-requests repository: importing that module here
   * would close a cycle between it and offers.
   *
   * (offerId, affiliateId) is unique on that table — a re-request after a rejection
   * resets the existing row rather than adding one — so there is a single status per
   * offer to find. DISTINCT ON only keeps that true if the constraint is ever relaxed.
   */
  async findAccessRequestStatuses(affiliateId: string): Promise<Map<string, string>> {
    const rows: { offerId: string; status: string }[] = await repository.manager.query(
      `SELECT DISTINCT ON ("offerId") "offerId", status
         FROM offer_access_requests
        WHERE "affiliateId" = $1
        ORDER BY "offerId", "createdAt" DESC`,
      [affiliateId],
    );
    return new Map(rows.map((row) => [row.offerId, row.status]));
  },

  /**
   * One browsable offer, for the affiliate detail page.
   *
   * Same shape and same APPROVED filter as findBrowsableForAffiliate, so an id that is
   * not in the browse list does not resolve here either — a direct URL is not a way
   * around the list. The advertiser is joined for the same reason it is there.
   */
  findBrowsableById(id: string): Promise<Offer | null> {
    return repository.findOne({
      where: { id, status: OfferStatus.APPROVED },
      relations: ['payoutRules', 'caps', 'advertiser'],
    });
  },

  /** The offer ids this affiliate has bookmarked — one query for the whole list. */
  async findFavouriteOfferIds(affiliateId: string): Promise<Set<string>> {
    const rows = await favourites.find({ where: { affiliateId }, select: ['offerId'] });
    return new Set(rows.map((row) => row.offerId));
  },

  /**
   * Adds or removes a bookmark, and reports where it ended up.
   *
   * Written to be safe against a double-click or two tabs: `orIgnore` leans on the
   * unique pair so a second add is a no-op rather than a constraint error, and a
   * delete that matches nothing is already idempotent.
   */
  async setFavourite(offerId: string, affiliateId: string, favourite: boolean): Promise<boolean> {
    if (favourite) {
      await favourites.createQueryBuilder().insert().values({ offerId, affiliateId }).orIgnore().execute();
    } else {
      await favourites.delete({ offerId, affiliateId });
    }
    return favourite;
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
