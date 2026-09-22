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

const smartLinkFields = z.object({
  name: z.string().trim().min(1).max(160),
  slug: slugSchema,
  description: z.string().trim().max(500).optional(),
  // No minimum. A link with no members is a valid thing to build — it is a plain
  // redirect that sends everything to `destinationUrl` — so the pairing below is what
  // keeps it from being a link with nowhere to go, not a floor on this field.
  offerIds: z.array(z.string().uuid()).default([]),
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
  // Nullable, not just optional: clearing the share on an existing link has to be
  // expressible, and `undefined` means "unchanged" on the partial update schema below.
  destinationUrl: z.union([z.string().trim().url(), z.literal(''), z.null()]).optional().transform((v) => (v === undefined ? undefined : v ? v : null)),
  // Capped at 100 — a link paying out more than the advertiser pays is a loss on every
  // conversion, and nothing downstream would catch it.
  revSharePercent: z.coerce.number().min(0).max(100).nullish(),
});

/**
 * The one rule that replaces "at least one member offer".
 *
 * Members and a destination are two different ways of answering the same question —
 * where does this click go? With members, the chosen offer supplies the address. With
 * none, `destinationUrl` is the address. A link with neither is not a misconfiguration
 * that degrades; it throws on every single visitor (see the smart-link branch of
 * `click.service.ts`), so it must not be saveable in the first place.
 *
 * Exported because `updateSmartLink` has to enforce the same rule against the merged
 * row: a partial update can clear the destination without mentioning `offerIds`, and a
 * schema that only sees the patch cannot tell that the result is a dead link.
 */
export const MISSING_DESTINATION_MESSAGE =
  'A smart-link with no member offers needs a destination URL to send its traffic to';

/**
 * A revenue share with no member offer is a number that cannot ever be applied.
 *
 * The share is a percentage of the sale's revenue — the amount the advertiser reports on
 * the postback, falling back to the member offer's configured figure — and it is read at
 * conversion time. A memberless link has no offer, so `/postback` rejects the hit before
 * a payout rule is ever loaded (`postback.service.ts` resolves the offer from the click
 * or the query and 404s when neither has one). Such a link cannot convert at all.
 *
 * Refused rather than ignored: a percentage sitting in the form looks like it is doing
 * something, and the only way to discover otherwise is to notice conversions that never
 * arrive.
 */
export const REV_SHARE_WITHOUT_MEMBERS_MESSAGE =
  'A smart-link with no member offers cannot pay a revenue share — it has no offer to take a percentage of';

export const createSmartLinkSchema = smartLinkFields.superRefine((value, ctx) => {
  if (value.offerIds.length === 0 && !value.destinationUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationUrl'], message: MISSING_DESTINATION_MESSAGE });
  }
  if (value.offerIds.length === 0 && value.revSharePercent != null) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['revSharePercent'], message: REV_SHARE_WITHOUT_MEMBERS_MESSAGE });
  }
});

export type CreateSmartLinkDto = z.infer<typeof createSmartLinkSchema>;

// `.partial()` on the plain object, not on the refined schema above: the cross-field
// check cannot run here, because "offerIds absent" means "unchanged", not "empty".
export const updateSmartLinkSchema = smartLinkFields.partial();

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
  destinationUrl: string | null;
  revSharePercent: number | null;
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
    destinationUrl: link.destinationUrl,
    revSharePercent: link.revSharePercent != null ? Number(link.revSharePercent) : null,
    // The Tracker's /sl route resolves which offer this lands on at click time.
    smartLinkUrl: `${env.PUBLIC_TRACKING_URL}/sl/${link.slug}?affiliateId=${affiliateId ?? '{affiliate_id}'}`,
    createdAt: link.createdAt.toISOString(),
  };
}
