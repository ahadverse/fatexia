import { NotFoundError, ValidationError } from '../../common/errors';
import { advertiserNetworkRepository } from './advertiser-network.repository';
import {
  toAdvertiserNetworkDto,
  type AdvertiserNetworkDto,
  type AdvertiserNetworkInputDto,
} from './advertiser-network.dto';

async function assertNameFree(name: string, exceptId?: string): Promise<void> {
  const existing = await advertiserNetworkRepository.findByName(name);
  if (existing && existing.id !== exceptId) {
    throw new ValidationError('A network with this name already exists');
  }
}

export const advertiserNetworkService = {
  async list(): Promise<AdvertiserNetworkDto[]> {
    return (await advertiserNetworkRepository.findAll()).map(toAdvertiserNetworkDto);
  },

  async create(input: AdvertiserNetworkInputDto): Promise<AdvertiserNetworkDto> {
    await assertNameFree(input.name);
    return toAdvertiserNetworkDto(await advertiserNetworkRepository.save(input));
  },

  async update(id: string, input: AdvertiserNetworkInputDto): Promise<AdvertiserNetworkDto> {
    const existing = await advertiserNetworkRepository.findById(id);
    if (!existing) throw new NotFoundError('Network not found');
    await assertNameFree(input.name, id);
    return toAdvertiserNetworkDto(await advertiserNetworkRepository.save({ ...existing, ...input }));
  },

  // Offers that used it keep working: the FK is ON DELETE SET NULL, so their postback
  // URL falls back to the generic {click_id}/{sum} macros.
  async remove(id: string): Promise<void> {
    await advertiserNetworkRepository.delete(id);
  },
};
