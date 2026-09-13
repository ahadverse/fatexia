import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppDataSource } from '../../infra/database/data-source';
import { Integration, type IntegrationProvider } from './integration.entity';

const repository = AppDataSource.getRepository(Integration);

export const integrationRepository = {
  // Grouped by provider and then by cascade order, so the Admin page lists a
  // provider's credentials in the order the fraud pipeline will actually try them.
  findAll(): Promise<Integration[]> {
    return repository.find({ order: { provider: 'ASC', position: 'ASC', createdAt: 'ASC' } });
  },

  findById(id: string): Promise<Integration | null> {
    return repository.findOne({ where: { id } });
  },

  /**
   * Every credential for a provider, in the order they should be tried.
   *
   * `createdAt` breaks a tie on `position` so the order is total — two rows left on
   * the default 0 would otherwise come back in whatever order the planner chose, and
   * a cascade that reshuffles itself between calls is impossible to reason about.
   */
  findAllByProvider(provider: IntegrationProvider): Promise<Integration[]> {
    return repository.find({ where: { provider }, order: { position: 'ASC', createdAt: 'ASC' } });
  },

  /** The first credential for a provider — for the ones that only ever have one. */
  findByProvider(provider: IntegrationProvider): Promise<Integration | null> {
    return repository.findOne({ where: { provider }, order: { position: 'ASC', createdAt: 'ASC' } });
  },

  create(fields: Partial<Integration>): Promise<Integration> {
    return repository.save(repository.create(fields));
  },

  async remove(id: string): Promise<void> {
    await repository.delete({ id });
  },

  /** Highest position currently used by a provider, for appending a new credential. */
  async maxPosition(provider: IntegrationProvider): Promise<number> {
    const row = await repository
      .createQueryBuilder('integration')
      .select('MAX(integration.position)', 'max')
      .where('integration.provider = :provider', { provider })
      .getRawOne<{ max: number | null }>();
    return row?.max ?? -1;
  },

  // Cast for the same reason as affiliate.repository — TypeORM's update typing
  // rejects the entity's own jsonb `config` shape.
  async update(id: string, fields: Partial<Integration>): Promise<void> {
    await repository.update({ id }, fields as QueryDeepPartialEntity<Integration>);
  },
};
