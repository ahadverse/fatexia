import { In } from 'typeorm';
import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppDataSource } from '../../infra/database/data-source';
import { isUuid } from '../../common/ref-id';
import { Affiliate } from './affiliate.entity';
import type { AffiliateFiltersDto } from './affiliate.dto';

const repository = AppDataSource.getRepository(Affiliate);

export const affiliateRepository = {
  findByUserId(userId: string): Promise<Affiliate | null> {
    return repository.findOne({ where: { userId }, relations: ['user'] });
  },

  findById(id: string): Promise<Affiliate | null> {
    return repository.findOne({ where: { id }, relations: ['user'] });
  },

  findByIds(ids: string[]): Promise<Affiliate[]> {
    if (ids.length === 0) return Promise.resolve([]);
    return repository.find({ where: { id: In(ids) }, relations: ['user'] });
  },

  findByReferralCode(referralCode: string): Promise<Affiliate | null> {
    return repository.findOne({ where: { referralCode } });
  },

  /**
   * Resolves whichever identifier a tracking link carried to the affiliate's uuid.
   *
   * New links name the affiliate by their `publicId` (`AFF-1001`); the ones already
   * pasted into ad platforms and other people's systems name the uuid, and those must
   * keep attributing.
   *
   * A uuid is passed straight back without a lookup — deliberately, on two counts. It
   * keeps the uuid path exactly as fast as it was, and an id that matches no affiliate
   * is meant to be recorded as-is rather than erased: click.entity.ts treats a click
   * that cannot be attributed as a fraud signal worth keeping, not a row to discard.
   * Only the publicId form needs a query, and an unknown one resolves to null for the
   * same reason a bad uuid stays unattributed.
   */
  async resolveIdForClick(identifier: string): Promise<string | null> {
    if (isUuid(identifier)) return identifier;
    const row = await repository.findOne({ where: { publicId: identifier }, select: ['id'] });
    return row?.id ?? null;
  },

  // The user relation is joined (not lazily loaded per row) because status and email
  // both live there and every list view renders them — a left join keeps this one query.
  findAll(filters: AffiliateFiltersDto): Promise<Affiliate[]> {
    const qb = repository.createQueryBuilder('affiliate').leftJoinAndSelect('affiliate.user', 'user');

    if (filters.status) {
      qb.andWhere('user.status = :status', { status: filters.status });
    }
    if (filters.country) {
      qb.andWhere('affiliate.country = :country', { country: filters.country });
    }
    if (filters.assignedManagerId) {
      qb.andWhere('affiliate."assignedManagerId" = :assignedManagerId', {
        assignedManagerId: filters.assignedManagerId,
      });
    }
    if (filters.referredByAffiliateId) {
      qb.andWhere('affiliate."referredByAffiliateId" = :referredByAffiliateId', {
        referredByAffiliateId: filters.referredByAffiliateId,
      });
    }
    if (filters.search) {
      // publicId is in here because AFF-1042 is what staff and affiliates actually
      // quote at each other (issue #21) — searching it has to work like a name does.
      qb.andWhere(
        '(affiliate."fullName" ILIKE :search OR user.email ILIKE :search OR affiliate."companyName" ILIKE :search OR affiliate."publicId" ILIKE :search)',
        { search: `%${filters.search}%` },
      );
    }
    if (filters.dateFrom) {
      qb.andWhere('affiliate."createdAt" >= :dateFrom', { dateFrom: filters.dateFrom });
    }
    if (filters.dateTo) {
      qb.andWhere('affiliate."createdAt" <= :dateTo', { dateTo: filters.dateTo });
    }

    return qb.orderBy('affiliate."createdAt"', 'DESC').getMany();
  },

  countByManager(managerId: string): Promise<number> {
    return repository.count({ where: { assignedManagerId: managerId } });
  },

  // The cast is TypeORM's jsonb typing, not a real looseness: QueryDeepPartialEntity
  // rejects a plain `Record<string, unknown>` for the payoutDetails column even though
  // it is exactly what the entity declares.
  //
  // The empty-object guard is load-bearing: callers build the patch by spreading only
  // the fields the caller actually sent, so a PATCH whose every field was dropped —
  // which is exactly what happens now that payout fields are stripped from an
  // affiliate's own profile update (issue #7) — arrives here as `{}`, and TypeORM
  // throws "update values are not defined" on that rather than treating it as a no-op.
  async update(id: string, fields: Partial<Affiliate>): Promise<void> {
    if (Object.keys(fields).length === 0) return;
    await repository.update({ id }, fields as QueryDeepPartialEntity<Affiliate>);
  },
};
