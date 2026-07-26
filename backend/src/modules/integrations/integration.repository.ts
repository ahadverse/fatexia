import type { QueryDeepPartialEntity } from 'typeorm/query-builder/QueryPartialEntity';
import { AppDataSource } from '../../infra/database/data-source';
import { Integration, type IntegrationProvider } from './integration.entity';

const repository = AppDataSource.getRepository(Integration);

export const integrationRepository = {
  findAll(): Promise<Integration[]> {
    return repository.find({ order: { name: 'ASC' } });
  },

  findById(id: string): Promise<Integration | null> {
    return repository.findOne({ where: { id } });
  },

  // `provider` is unique, so this is a single indexed read — the lookup the fraud
  // pipeline uses to resolve a credential.
  findByProvider(provider: IntegrationProvider): Promise<Integration | null> {
    return repository.findOne({ where: { provider } });
  },

  // Cast for the same reason as affiliate.repository — TypeORM's update typing
  // rejects the entity's own jsonb `config` shape.
  async update(id: string, fields: Partial<Integration>): Promise<void> {
    await repository.update({ id }, fields as QueryDeepPartialEntity<Integration>);
  },
};
