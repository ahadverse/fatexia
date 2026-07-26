import { z } from 'zod';
import type { OfferCategory } from './offer-category.entity';

export const createOfferCategorySchema = z.object({
  name: z.string().min(1),
});

export type CreateOfferCategoryDto = z.infer<typeof createOfferCategorySchema>;

export interface OfferCategoryDto {
  id: string;
  name: string;
}

export function toOfferCategoryDto(category: OfferCategory): OfferCategoryDto {
  return { id: category.id, name: category.name };
}
