import { AppDataSource } from '../../infra/database/data-source';
import { Affiliate } from '../affiliates/affiliate.entity';
import { UserStatus } from '../users/user.entity';
import { Manager } from './manager.entity';
import type { ManagerFiltersDto } from './manager.dto';

const repository = AppDataSource.getRepository(Manager);

export interface ManagerAffiliateCountRow {
  assignedManagerId: string;
  count: string;
}

export const managerRepository = {
  findAll(filters: ManagerFiltersDto): Promise<Manager[]> {
    const qb = repository.createQueryBuilder('manager').leftJoinAndSelect('manager.user', 'user');
    if (filters.managerRole) {
      qb.andWhere('manager."managerRole" = :managerRole', { managerRole: filters.managerRole });
    }
    if (filters.status) {
      qb.andWhere('user.status = :status', { status: filters.status });
    }
    if (filters.search) {
      qb.andWhere('(manager."fullName" ILIKE :search OR user.email ILIKE :search OR manager."publicId" ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }
    return qb.orderBy('manager."createdAt"', 'DESC').getMany();
  },

  findById(id: string): Promise<Manager | null> {
    return repository.findOne({ where: { id }, relations: ['user'] });
  },

  // The network runs on one manager, so "the active manager" is unambiguous in practice;
  // if there are ever several, the longest-serving one is the default.
  async findDefaultActiveId(): Promise<string | null> {
    const row = await repository
      .createQueryBuilder('manager')
      .innerJoin('manager.user', 'user')
      .where('user.status = :status', { status: UserStatus.ACTIVE })
      .orderBy('manager."createdAt"', 'ASC')
      .select('manager.id', 'id')
      .getRawOne<{ id: string }>();
    return row?.id ?? null;
  },

  findByUserId(userId: string): Promise<Manager | null> {
    return repository.findOne({ where: { userId }, relations: ['user'] });
  },

  // One grouped query for the whole list rather than a count per manager — the
  // Managers pages always render this alongside every row.
  affiliateCountsByManager(): Promise<ManagerAffiliateCountRow[]> {
    return AppDataSource.getRepository(Affiliate)
      .createQueryBuilder('affiliate')
      .select('affiliate."assignedManagerId"', 'assignedManagerId')
      .addSelect('COUNT(*)', 'count')
      .where('affiliate."assignedManagerId" IS NOT NULL')
      .groupBy('affiliate."assignedManagerId"')
      .getRawMany<ManagerAffiliateCountRow>();
  },

  // Same empty-patch guard as affiliateRepository.update — the caller spreads only the
  // fields that were actually sent, and TypeORM throws on an empty update rather than
  // treating it as the no-op it is.
  async update(id: string, fields: Partial<Manager>): Promise<void> {
    if (Object.keys(fields).length === 0) return;
    await repository.update({ id }, fields);
  },
};
