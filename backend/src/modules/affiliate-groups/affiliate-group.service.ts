import { NotFoundError, ValidationError } from '../../common/errors';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { affiliateGroupRepository } from './affiliate-group.repository';
import {
  toAffiliateGroupDto,
  type AffiliateGroupDto,
  type CreateAffiliateGroupDto,
  type UpdateAffiliateGroupDto,
} from './affiliate-group.dto';

// A group whose membership references a deleted affiliate would silently widen or
// narrow offer targeting, so membership is validated on every write.
async function assertAffiliatesExist(affiliateIds: string[]): Promise<void> {
  if (affiliateIds.length === 0) return;
  const found = await affiliateRepository.findByIds(affiliateIds);
  if (found.length !== new Set(affiliateIds).size) {
    throw new ValidationError('One or more affiliate ids do not exist');
  }
}

export const affiliateGroupService = {
  async getGroups(): Promise<AffiliateGroupDto[]> {
    const groups = await affiliateGroupRepository.findAll();
    return groups.map(toAffiliateGroupDto);
  },

  async getGroup(id: string): Promise<AffiliateGroupDto> {
    const group = await affiliateGroupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Affiliate group not found');
    }
    return toAffiliateGroupDto(group);
  },

  async createGroup(dto: CreateAffiliateGroupDto): Promise<AffiliateGroupDto> {
    if (await affiliateGroupRepository.findByName(dto.name)) {
      throw new ValidationError('A group with this name already exists');
    }
    await assertAffiliatesExist(dto.affiliateIds);
    const group = await affiliateGroupRepository.create({
      name: dto.name,
      description: dto.description ?? null,
      affiliateIds: dto.affiliateIds,
    });
    return toAffiliateGroupDto(group);
  },

  async updateGroup(id: string, dto: UpdateAffiliateGroupDto): Promise<AffiliateGroupDto> {
    const group = await affiliateGroupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Affiliate group not found');
    }
    if (dto.name && dto.name !== group.name) {
      if (await affiliateGroupRepository.findByName(dto.name)) {
        throw new ValidationError('A group with this name already exists');
      }
    }
    if (dto.affiliateIds) {
      await assertAffiliatesExist(dto.affiliateIds);
    }
    await affiliateGroupRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.affiliateIds !== undefined && { affiliateIds: dto.affiliateIds }),
    });
    return this.getGroup(id);
  },

  async deleteGroup(id: string): Promise<void> {
    const group = await affiliateGroupRepository.findById(id);
    if (!group) {
      throw new NotFoundError('Affiliate group not found');
    }
    await affiliateGroupRepository.delete(id);
  },
};
