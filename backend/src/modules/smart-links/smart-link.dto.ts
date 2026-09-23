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
  // Both nullable rather than merely optional, for the same reason destinationUrl is:
  // removing a thumbnail or a preview link on an existing link has to reach the server
  // as "set this to nothing", and `undefined` means "unchanged" on the partial update
  // schema below. The empty string a cleared input sends is folded into null here so
  // the column never holds `''`, which reads as a URL everywhere downstream.
  iconUrl: z.union([z.string().trim().url(), z.literal(''), z.null()]).optional().transform((v) => (v === undefined ? undefined : v ? v : null)),
  previewLink: z.union([z.string().trim().url(), z.literal(''), z.null()]).optional().transform((v) => (v === undefined ? undefined : v ? v : null)),
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
 * A revenue share is allowed with or without member offers, and means the same thing
 * either way: this percentage of the sale the advertiser reports.
 *
 * It used to be refused on a memberless link, correctly at the time — such a link had no
 * offer, `/postback` resolved an offer before doing anything, and so the link could not
 * convert at all. That is no longer true. A memberless link now logs its clicks with a
 * null `offerId`, and its conversions are priced from *this* percentage against the
 * postback's `sum`, with no payout rule involved. The share is the only rate such a link
 * has, so requiring members would be requiring the one thing it does not use.
 *
 * What is still enforced at conversion time, in `computeSmartLinkAmounts`: a memberless
 * link with no share cannot be priced, and its postback is refused rather than booked at
 * zero. Not enforced here, because a link may legitimately be saved before its rate is
 * decided — it simply cannot earn until it is.
 */
export const createSmartLinkSchema = smartLinkFields.superRefine((value, ctx) => {
  if (value.offerIds.length === 0 && !value.destinationUrl) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['destinationUrl'], message: MISSING_DESTINATION_MESSAGE });
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
  iconUrl: string | null;
  previewLink: string | null;
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
    iconUrl: link.iconUrl,
    previewLink: link.previewLink,
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
