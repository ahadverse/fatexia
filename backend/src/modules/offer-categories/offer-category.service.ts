import { ValidationError } from '../../common/errors';
import { offerCategoryRepository } from './offer-category.repository';
import { toOfferCategoryDto, type OfferCategoryDto } from './offer-category.dto';

export const offerCategoryService = {
  async getOfferCategories(): Promise<OfferCategoryDto[]> {
    const rows = await offerCategoryRepository.findAll();
    return rows.map(toOfferCategoryDto);
  },

  async createOfferCategory(name: string): Promise<OfferCategoryDto> {
    const existing = await offerCategoryRepository.findByName(name);
    if (existing) {
      throw new ValidationError('A category with this name already exists');
    }
    const created = await offerCategoryRepository.create(name);
    return toOfferCategoryDto(created);
  },

  async deleteOfferCategory(id: string): Promise<void> {
    await offerCategoryRepository.delete(id);
  },
};
