import { NotFoundError, ValidationError } from '../../common/errors';
import { advertiserRepository } from './advertiser.repository';
import {
  toAdvertiserDto,
  type AdvertiserDto,
  type AdvertiserFiltersDto,
  type CreateAdvertiserDto,
  type UpdateAdvertiserDto,
  type UpdateAdvertiserStatusDto,
} from './advertiser.dto';

export const advertiserService = {
  async getAdvertisers(filters: AdvertiserFiltersDto = {}): Promise<AdvertiserDto[]> {
    const [rows, counts] = await Promise.all([advertiserRepository.findAll(filters), advertiserRepository.offerCounts()]);
    const countById = new Map(counts.map((c) => [c.advertiserId, Number(c.count)]));
    return rows.map((row) => toAdvertiserDto(row, countById.get(row.id) ?? 0));
  },

  async getAdvertiser(id: string): Promise<AdvertiserDto> {
    const advertiser = await advertiserRepository.findById(id);
    if (!advertiser) {
      throw new NotFoundError('Advertiser not found');
    }
    const counts = await advertiserRepository.offerCounts();
    const count = counts.find((c) => c.advertiserId === id);
    return toAdvertiserDto(advertiser, count ? Number(count.count) : 0);
  },

  async createAdvertiser(dto: CreateAdvertiserDto): Promise<AdvertiserDto> {
    if (await advertiserRepository.findByName(dto.name)) {
      throw new ValidationError('An advertiser with this name already exists');
    }
    const created = await advertiserRepository.create({
      name: dto.name,
      status: dto.status,
      contactName: dto.contactName ?? null,
      contactEmail: dto.contactEmail ?? null,
      phone: dto.phone ?? null,
      country: dto.country ?? null,
      websiteUrl: dto.websiteUrl ?? null,
      accountManagerId: dto.accountManagerId ?? null,
      notes: dto.notes ?? null,
    });
    return toAdvertiserDto(created, 0);
  },

  async updateAdvertiser(id: string, dto: UpdateAdvertiserDto): Promise<AdvertiserDto> {
    const advertiser = await advertiserRepository.findById(id);
    if (!advertiser) {
      throw new NotFoundError('Advertiser not found');
    }
    if (dto.name && dto.name !== advertiser.name && (await advertiserRepository.findByName(dto.name))) {
      throw new ValidationError('An advertiser with this name already exists');
    }
    await advertiserRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.status !== undefined && { status: dto.status }),
      ...(dto.contactName !== undefined && { contactName: dto.contactName ?? null }),
      ...(dto.contactEmail !== undefined && { contactEmail: dto.contactEmail ?? null }),
      ...(dto.phone !== undefined && { phone: dto.phone ?? null }),
      ...(dto.country !== undefined && { country: dto.country ?? null }),
      ...(dto.websiteUrl !== undefined && { websiteUrl: dto.websiteUrl ?? null }),
      ...(dto.accountManagerId !== undefined && { accountManagerId: dto.accountManagerId ?? null }),
      ...(dto.notes !== undefined && { notes: dto.notes ?? null }),
    });
    return this.getAdvertiser(id);
  },

  async updateStatus(id: string, dto: UpdateAdvertiserStatusDto): Promise<AdvertiserDto> {
    const advertiser = await advertiserRepository.findById(id);
    if (!advertiser) {
      throw new NotFoundError('Advertiser not found');
    }
    await advertiserRepository.update(id, { status: dto.status });
    return this.getAdvertiser(id);
  },
};
