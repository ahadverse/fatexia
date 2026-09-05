import { z } from 'zod';
import { env } from '../../common/env';
import { SmartLinkRotation, SmartLinkStatus, type SmartLink } from './smart-link.entity';

export const smartLinkFiltersSchema = z.object({
  status: z.nativeEnum(SmartLinkStatus).optional(),
  search: z.string().optional(),
});

export type SmartLinkFiltersDto = z.infer<typeof smartLinkFiltersSchema>;

// Slug is URL-path material, so it is constrained rather than sanitized after the
// fact — lowercase alphanumerics and single hyphens only.
const slugSchema = z
  .string()
  .trim()
  .min(2)
  .max(60)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug may contain lowercase letters, numbers and single hyphens only');

export const createSmartLinkSchema = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slugSchema,
  description: z.string().trim().max(500).optional(),
  offerIds: z.array(z.string().uuid()).min(1, 'A smart-link needs at least one member offer'),
  countries: z.array(z.string().trim().max(2)).default([]),
  devices: z.array(z.string().trim().max(40)).default([]),
  rotation: z.nativeEnum(SmartLinkRotation).default(SmartLinkRotation.TOP_PAYOUT),
  status: z.nativeEnum(SmartLinkStatus).default(SmartLinkStatus.ACTIVE),
  fallbackUrl: z
    .string()
    .trim()
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
});

export type CreateSmartLinkDto = z.infer<typeof createSmartLinkSchema>;

export const updateSmartLinkSchema = createSmartLinkSchema.partial();

export type UpdateSmartLinkDto = z.infer<typeof updateSmartLinkSchema>;

export interface SmartLinkDto {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  offerIds: string[];
  offerCount: number;
  countries: string[];
  devices: string[];
  rotation: SmartLinkRotation;
  status: SmartLinkStatus;
  fallbackUrl: string | null;
  smartLinkUrl: string;
  createdAt: string;
}

/**
 * `affiliateId` is filled in server-side for an affiliate caller and left as the
 * `{affiliate_id}` macro for staff.
 *
 * It used to be left unresolved for everyone, with a comment saying the affiliate
 * portal would substitute it — the portal never did, so every affiliate was copying a
 * link with a literal `{affiliate_id}` in the query string and sending traffic that
 * could not be attributed to them. Resolved here rather than in the portal because
 * the server already knows who is asking from their JWT, and an id the client builds
 * into its own tracking link is an id the client can get wrong.
 */
export function toSmartLinkDto(link: SmartLink, affiliateId?: string): SmartLinkDto {
  return {
    id: link.id,
    name: link.name,
    slug: link.slug,
    description: link.description,
    offerIds: link.offerIds ?? [],
    offerCount: (link.offerIds ?? []).length,
    countries: link.countries ?? [],
    devices: link.devices ?? [],
    rotation: link.rotation,
    status: link.status,
    fallbackUrl: link.fallbackUrl,
    // The Tracker's /sl route resolves which offer this lands on at click time.
    smartLinkUrl: `${env.PUBLIC_TRACKING_URL}/sl/${link.slug}?affiliateId=${affiliateId ?? '{affiliate_id}'}`,
    createdAt: link.createdAt.toISOString(),
  };
}
