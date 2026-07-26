import { AppDataSource } from '../../infra/database/data-source';
import { NETWORK_SETTINGS_ID, NetworkSetting } from './network-setting.entity';

const repository = AppDataSource.getRepository(NetworkSetting);

export const networkSettingRepository = {
  find(): Promise<NetworkSetting | null> {
    return repository.findOne({ where: { id: NETWORK_SETTINGS_ID } });
  },

  // Creates the singleton row from the entity's column defaults on first read, so a
  // fresh database (or one seeded before this module existed) still serves settings.
  createDefault(): Promise<NetworkSetting> {
    return repository.save(repository.create({ id: NETWORK_SETTINGS_ID }));
  },

  async update(fields: Partial<NetworkSetting>): Promise<void> {
    await repository.update({ id: NETWORK_SETTINGS_ID }, fields);
  },
};
