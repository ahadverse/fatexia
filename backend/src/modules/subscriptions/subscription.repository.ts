import { AppDataSource } from '../../infra/database/data-source';
import { Subscription } from './subscription.entity';
import type { SubscriptionFiltersDto } from './subscription.dto';

const repository = AppDataSource.getRepository(Subscription);

export const subscriptionRepository = {
  findAll(filters: SubscriptionFiltersDto): Promise<Subscription[]> {
    const qb = repository.createQueryBuilder('subscription');
    if (filters.advertiserId) {
      qb.andWhere('subscription."advertiserId" = :advertiserId', { advertiserId: filters.advertiserId });
    }
    if (filters.status) {
      qb.andWhere('subscription.status = :status', { status: filters.status });
    }
    if (filters.plan) {
      qb.andWhere('subscription.plan = :plan', { plan: filters.plan });
    }
    return qb.orderBy('subscription."createdAt"', 'DESC').getMany();
  },

  findById(id: string): Promise<Subscription | null> {
    return repository.findOne({ where: { id } });
  },

  create(data: Partial<Subscription>): Promise<Subscription> {
    return repository.save(repository.create(data));
  },

  async update(id: string, fields: Partial<Subscription>): Promise<void> {
    await repository.update({ id }, fields);
  },
};
