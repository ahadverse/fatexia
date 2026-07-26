import { z } from 'zod';
import type { AffiliateGroup } from './affiliate-group.entity';

export const createAffiliateGroupSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  affiliateIds: z.array(z.string().uuid()).default([]),
});

export type CreateAffiliateGroupDto = z.infer<typeof createAffiliateGroupSchema>;

export const updateAffiliateGroupSchema = createAffiliateGroupSchema.partial();

export type UpdateAffiliateGroupDto = z.infer<typeof updateAffiliateGroupSchema>;

export interface AffiliateGroupDto {
  id: string;
  name: string;
  description: string | null;
  affiliateIds: string[];
  memberCount: number;
  createdAt: string;
}

export function toAffiliateGroupDto(group: AffiliateGroup): AffiliateGroupDto {
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    affiliateIds: group.affiliateIds ?? [],
    memberCount: (group.affiliateIds ?? []).length,
    createdAt: group.createdAt.toISOString(),
  };
}
