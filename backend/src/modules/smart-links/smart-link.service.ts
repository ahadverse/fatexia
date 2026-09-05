import { In } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { NotFoundError, ValidationError } from '../../common/errors';
import { Offer, OfferStatus } from '../offers/offer.entity';
import { smartLinkRepository } from './smart-link.repository';
import {
  toSmartLinkDto,
  type CreateSmartLinkDto,
  type SmartLinkDto,
  type SmartLinkFiltersDto,
  type UpdateSmartLinkDto,
} from './smart-link.dto';

// A smart-link pointing at a non-approved offer would resolve to a dead redirect at
// click time, so membership is validated against live APPROVED offers on every write.
async function assertOffersApproved(offerIds: string[]): Promise<void> {
  if (offerIds.length === 0) return;
  const offers = await AppDataSource.getRepository(Offer).find({
    where: { id: In(offerIds), status: OfferStatus.APPROVED },
    select: ['id'],
  });
  if (offers.length !== new Set(offerIds).size) {
    throw new ValidationError('Every member offer must exist and be APPROVED');
  }
}

export const smartLinkService = {
  // `affiliateId` is passed only for an affiliate caller, so their copy of every link
  // already carries their own id (see toSmartLinkDto).
  async getSmartLinks(filters: SmartLinkFiltersDto, affiliateId?: string): Promise<SmartLinkDto[]> {
    const links = await smartLinkRepository.findAll(filters);
    return links.map((link) => toSmartLinkDto(link, affiliateId));
  },

  async getSmartLink(id: string): Promise<SmartLinkDto> {
    const link = await smartLinkRepository.findById(id);
    if (!link) {
      throw new NotFoundError('Smart-link not found');
    }
    return toSmartLinkDto(link);
  },

  async createSmartLink(dto: CreateSmartLinkDto): Promise<SmartLinkDto> {
    if (await smartLinkRepository.findBySlug(dto.slug)) {
      throw new ValidationError('A smart-link with this slug already exists');
    }
    await assertOffersApproved(dto.offerIds);
    const created = await smartLinkRepository.create({
      name: dto.name,
      slug: dto.slug,
      description: dto.description ?? null,
      offerIds: dto.offerIds,
      countries: dto.countries,
      devices: dto.devices,
      rotation: dto.rotation,
      status: dto.status,
      fallbackUrl: dto.fallbackUrl ?? null,
    });
    return toSmartLinkDto(created);
  },

  async updateSmartLink(id: string, dto: UpdateSmartLinkDto): Promise<SmartLinkDto> {
    const link = await smartLinkRepository.findById(id);
    if (!link) {
      throw new NotFoundError('Smart-link not found');
    }
    if (dto.slug && dto.slug !== link.slug && (await smartLinkRepository.findBySlug(dto.slug))) {
      throw new ValidationError('A smart-link with this slug already exists');
    }
    if (dto.offerIds) {
      await assertOffersApproved(dto.offerIds);
    }
    await smartLinkRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.slug !== undefined && { slug: dto.slug }),
      ...(dto.description !== undefined && { description: dto.description ?? null }),
      ...(dto.offerIds !== undefined && { offerIds: dto.offerIds }),
      ...(dto.countries !== undefined && { countries: dto.countries }),
      ...(dto.devices !== undefined && { devices: dto.devices }),
      ...(dto.rotation !== undefined && { rotation: dto.rotation }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.fallbackUrl !== undefined && { fallbackUrl: dto.fallbackUrl ?? null }),
    });
    return this.getSmartLink(id);
  },

  async deleteSmartLink(id: string): Promise<void> {
    const link = await smartLinkRepository.findById(id);
    if (!link) {
      throw new NotFoundError('Smart-link not found');
    }
    await smartLinkRepository.delete(id);
  },
};
