import { AppDataSource } from '../../infra/database/data-source';
import { Affiliate } from '../affiliates/affiliate.entity';
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
      qb.andWhere('(manager."fullName" ILIKE :search OR user.email ILIKE :search)', {
        search: `%${filters.search}%`,
      });
    }
    return qb.orderBy('manager."createdAt"', 'DESC').getMany();
  },

  findById(id: string): Promise<Manager | null> {
    return repository.findOne({ where: { id }, relations: ['user'] });
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

  async update(id: string, fields: Partial<Manager>): Promise<void> {
    await repository.update({ id }, fields);
  },
};
