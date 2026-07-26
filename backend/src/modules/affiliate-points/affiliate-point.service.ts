import { NotFoundError } from '../../common/errors';
import { paginate, type Paginated } from '../../common/pagination';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { affiliateService } from '../affiliates/affiliate.service';
import { affiliatePointRepository } from './affiliate-point.repository';
import {
  toAffiliatePointDto,
  type AdjustPointsDto,
  type AffiliatePointBalanceDto,
  type AffiliatePointDto,
  type PointFiltersDto,
} from './affiliate-point.dto';

export const affiliatePointService = {
  async getEntries(filters: PointFiltersDto): Promise<Paginated<AffiliatePointDto>> {
    const [rows, total] = await affiliatePointRepository.findAll(filters);
    return paginate(rows.map(toAffiliatePointDto), total, filters);
  },

  // Two queries, not N+1: one grouped aggregate, then one batched affiliate lookup
  // to attach names to the ids the aggregate returned.
  async getBalances(): Promise<AffiliatePointBalanceDto[]> {
    const balances = await affiliatePointRepository.balances();
    const affiliates = await affiliateRepository.findByIds(balances.map((b) => b.affiliateId));
    const byId = new Map(affiliates.map((a) => [a.id, a]));

    return balances.map((balance) => {
      const affiliate = byId.get(balance.affiliateId);
      return {
        affiliateId: balance.affiliateId,
        affiliateName: affiliate?.fullName ?? null,
        email: affiliate?.user?.email ?? '',
        totalPoints: Number(balance.totalPoints),
        entryCount: Number(balance.entryCount),
      };
    });
  },

  // Affiliate self-service: their own ledger and running total. Read-only by design —
  // points are informational and have no redemption path (PLAN-backend.md), so there
  // is deliberately no affiliate-side write route here.
  async getOwnPoints(
    userId: string,
    filters: PointFiltersDto,
  ): Promise<Paginated<AffiliatePointDto> & { totalPoints: number }> {
    const affiliateId = await affiliateService.resolveAffiliateId(userId);
    const [[rows, total], balances] = await Promise.all([
      affiliatePointRepository.findAll({ ...filters, affiliateId }),
      affiliatePointRepository.balances(),
    ]);
    const mine = balances.find((balance) => balance.affiliateId === affiliateId);

    return {
      ...paginate(rows.map(toAffiliatePointDto), total, filters),
      totalPoints: Number(mine?.totalPoints ?? 0),
    };
  },

  async adjust(dto: AdjustPointsDto, adminUserId: string): Promise<AffiliatePointDto> {
    const affiliate = await affiliateRepository.findById(dto.affiliateId);
    if (!affiliate) {
      throw new NotFoundError('Affiliate not found');
    }
    const row = await affiliatePointRepository.create({
      affiliateId: dto.affiliateId,
      conversionId: null,
      points: dto.points,
      reason: dto.reason,
      createdByUserId: adminUserId,
    });
    return toAffiliatePointDto(row);
  },
};
