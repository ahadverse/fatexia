import { AppDataSource } from '../../infra/database/data-source';
import { GlobalPostback, PostbackDirectionKind } from './global-postback.entity';

const repository = () => AppDataSource.getRepository(GlobalPostback);

export const globalPostbackRepository = {
  findAll(): Promise<GlobalPostback[]> {
    return repository().find({ order: { direction: 'ASC', createdAt: 'ASC' } });
  },

  findById(id: string): Promise<GlobalPostback | null> {
    return repository().findOne({ where: { id } });
  },

  /** Enabled entries for one direction — what the postback paths actually act on. */
  findEnabled(direction: PostbackDirectionKind): Promise<GlobalPostback[]> {
    return repository().find({ where: { direction, enabled: true }, order: { createdAt: 'ASC' } });
  },

  create(fields: Partial<GlobalPostback>): Promise<GlobalPostback> {
    return repository().save(repository().create(fields));
  },

  async update(id: string, fields: Partial<GlobalPostback>): Promise<void> {
    if (Object.keys(fields).length === 0) return;
    await repository().update({ id }, fields);
  },

  async delete(id: string): Promise<void> {
    await repository().delete({ id });
  },

  async markUsed(id: string): Promise<void> {
    await repository().update({ id }, { lastUsedAt: new Date() });
  },
};
