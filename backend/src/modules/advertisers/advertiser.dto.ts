import { z } from 'zod';
import { AdvertiserStatus, type Advertiser } from './advertiser.entity';

export const advertiserFiltersSchema = z.object({
  status: z.nativeEnum(AdvertiserStatus).optional(),
  country: z.string().optional(),
  accountManagerId: z.string().uuid().optional(),
  search: z.string().optional(),
});

export type AdvertiserFiltersDto = z.infer<typeof advertiserFiltersSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const createAdvertiserSchema = z.object({
  name: z.string().trim().min(1).max(160),
  status: z.nativeEnum(AdvertiserStatus).default(AdvertiserStatus.ACTIVE),
  contactName: optionalText(120),
  contactEmail: z
    .string()
    .trim()
    .email()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  phone: optionalText(40),
  country: optionalText(80),
  websiteUrl: optionalText(255),
  accountManagerId: z.string().uuid().optional().nullable(),
  notes: optionalText(1000),
});

export type CreateAdvertiserDto = z.infer<typeof createAdvertiserSchema>;

export const updateAdvertiserSchema = createAdvertiserSchema.partial();

export type UpdateAdvertiserDto = z.infer<typeof updateAdvertiserSchema>;

export const updateAdvertiserStatusSchema = z.object({
  status: z.nativeEnum(AdvertiserStatus),
});

export type UpdateAdvertiserStatusDto = z.infer<typeof updateAdvertiserStatusSchema>;

export interface AdvertiserDto {
  id: string;
  name: string;
  status: AdvertiserStatus;
  contactName: string | null;
  contactEmail: string | null;
  phone: string | null;
  country: string | null;
  websiteUrl: string | null;
  accountManagerId: string | null;
  notes: string | null;
  offerCount: number;
  createdAt: string;
}

export function toAdvertiserDto(advertiser: Advertiser, offerCount = 0): AdvertiserDto {
  return {
    id: advertiser.id,
    name: advertiser.name,
    status: advertiser.status,
    contactName: advertiser.contactName,
    contactEmail: advertiser.contactEmail,
    phone: advertiser.phone,
    country: advertiser.country,
    websiteUrl: advertiser.websiteUrl,
    accountManagerId: advertiser.accountManagerId,
    notes: advertiser.notes,
    offerCount,
    createdAt: advertiser.createdAt.toISOString(),
  };
}
