import { NotFoundError } from '../../common/errors';
import { globalPostbackRepository } from './global-postback.repository';
import {
  toGlobalPostbackDto,
  type CreateGlobalPostbackDto,
  type GlobalPostbackDto,
  type UpdateGlobalPostbackDto,
} from './global-postback.dto';

export const globalPostbackService = {
  async list(): Promise<GlobalPostbackDto[]> {
    return (await globalPostbackRepository.findAll()).map(toGlobalPostbackDto);
  },

  async create(dto: CreateGlobalPostbackDto): Promise<GlobalPostbackDto> {
    const row = await globalPostbackRepository.create({
      name: dto.name,
      direction: dto.direction,
      url: dto.url ?? null,
      secret: dto.secret ?? null,
      allowedIps: dto.allowedIps ?? null,
      enabled: dto.enabled,
    });
    return toGlobalPostbackDto(row);
  },

  async update(id: string, dto: UpdateGlobalPostbackDto): Promise<GlobalPostbackDto> {
    const existing = await globalPostbackRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Postback not found');
    }

    await globalPostbackRepository.update(id, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.url !== undefined && { url: dto.url ?? null }),
      // A blank secret leaves the stored one alone rather than clearing it: the form
      // never receives the real value back, so an untouched field arrives empty and
      // would otherwise wipe the credential on every unrelated edit.
      ...(dto.secret ? { secret: dto.secret } : {}),
      ...(dto.allowedIps !== undefined && { allowedIps: dto.allowedIps ?? null }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
    });

    const updated = await globalPostbackRepository.findById(id);
    return toGlobalPostbackDto(updated!);
  },

  async remove(id: string): Promise<void> {
    const existing = await globalPostbackRepository.findById(id);
    if (!existing) {
      throw new NotFoundError('Postback not found');
    }
    await globalPostbackRepository.delete(id);
  },
};
