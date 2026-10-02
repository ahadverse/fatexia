import { AppDataSource } from '../../infra/database/data-source';
import { AdvertiserNetwork } from './advertiser-network.entity';

const repository = AppDataSource.getRepository(AdvertiserNetwork);

export const advertiserNetworkRepository = {
  findAll(): Promise<AdvertiserNetwork[]> {
    return repository.find({ order: { name: 'ASC' } });
  },

  findById(id: string): Promise<AdvertiserNetwork | null> {
    return repository.findOne({ where: { id } });
  },

  findByName(name: string): Promise<AdvertiserNetwork | null> {
    return repository.findOne({ where: { name } });
  },

  save(network: Partial<AdvertiserNetwork>): Promise<AdvertiserNetwork> {
    return repository.save(repository.create(network));
  },

  delete(id: string): Promise<void> {
    return repository.delete({ id }).then(() => undefined);
  },
};
