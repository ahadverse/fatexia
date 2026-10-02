import { z } from 'zod';
import type { AdvertiserNetwork } from './advertiser-network.entity';

// Verbatim, so only surrounding whitespace is trimmed, never the delimiters. A token
// with whitespace inside can never match a macro, so it is refused rather than saved.
const tokenSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => !/\s/.test(value), { message: 'A token cannot contain spaces' });

export const advertiserNetworkInputSchema = z.object({
  name: z.string().trim().min(1).max(100),
  clickIdToken: tokenSchema,
  payoutToken: z
    .union([tokenSchema, z.literal('')])
    .nullish()
    .transform((value) => (value ? value : null)),
});

export type AdvertiserNetworkInputDto = z.infer<typeof advertiserNetworkInputSchema>;

export interface AdvertiserNetworkDto {
  id: string;
  name: string;
  clickIdToken: string;
  payoutToken: string | null;
}

export function toAdvertiserNetworkDto(network: AdvertiserNetwork): AdvertiserNetworkDto {
  return {
    id: network.id,
    name: network.name,
    clickIdToken: network.clickIdToken,
    payoutToken: network.payoutToken,
  };
}
