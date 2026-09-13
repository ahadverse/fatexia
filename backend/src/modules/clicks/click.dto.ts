import { z } from 'zod';
import { managerScopeField } from '../../common/manager-scope-sql';
import { isPublicId, isRefId, isUuid } from '../../common/ref-id';
import { ClickQualityStatus } from './click.entity';

// Sub-ids are affiliate-controlled free text on a public endpoint — length-capped so
// a crafted link can't push oversized values into the click row.
const subId = z.string().max(255).optional();

/**
 * A malformed affiliate id is dropped, not rejected.
 *
 * click.entity.ts states the intent plainly — "a click can arrive with a missing or
 * invalid affiliateId (bad link, tampering); still logged, a null attribution is
 * itself a fraud signal" — but a strict `.uuid()` here turned that into a 400, so the
 * visitor never reached the advertiser and the click was never recorded at all.
 * Rejecting the whole redirect punishes the visitor for the affiliate's broken link.
 *
 * Either form is accepted: the `publicId` new links carry (`AFF-1001`), or the uuid
 * every link already in the wild carries. Resolved to the uuid in click.service.
 *
 * Getting this list wrong is silent and expensive. It briefly accepted only digits and
 * uuids, while the links being handed out carried `AFF-1001` — so every click came in
 * unattributed, the affiliate earned nothing for it, and nothing anywhere reported an
 * error. Whatever affiliateTrackingLinkFor puts in a link has to be accepted here.
 */
const looseAffiliateId = z
  .string()
  .optional()
  .transform((value) => (value && (isPublicId(value) || isUuid(value)) ? value : undefined));

/**
 * The offer a link names — its short `refId`, or the uuid older links carry.
 *
 * Unlike the affiliate id this one is required and strict about shape: a click with no
 * resolvable offer has nowhere to redirect to, so there is nothing to salvage.
 */
const offerIdentifier = z.string().refine((value) => isRefId(value) || z.string().uuid().safeParse(value).success, {
  message: 'Invalid offer',
});

export const clickQuerySchema = z.object({
  offerId: offerIdentifier,
  affiliateId: looseAffiliateId,
  sub1: subId,
  sub2: subId,
  sub3: subId,
  sub4: subId,
  sub5: subId,
  sub6: subId,
  sub7: subId,
  sub8: subId,
});

export type ClickQueryDto = z.infer<typeof clickQuerySchema>;

// Same query surface as a tracking link minus `offerId` — a smart-link names its
// target in the path, and the offer is chosen at redirect time.
export const smartLinkClickQuerySchema = clickQuerySchema.omit({ offerId: true });

export type SmartLinkClickQueryDto = z.infer<typeof smartLinkClickQuerySchema>;

// Slugs are admin-authored and appear in a public URL. Validated here so a crafted
// path can't reach the repository as an oversized or exotic string.
export const smartLinkClickParamsSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-zA-Z0-9_-]+$/, 'Invalid smart-link'),
});

// Whitelist, not free text: the value reaches an ORDER BY, so it is mapped to a fixed
// column expression in the repository and never interpolated.
export const CLICK_SORT_FIELDS = ['createdAt', 'ip', 'countryCode', 'isUnique'] as const;
export type ClickSortField = (typeof CLICK_SORT_FIELDS)[number];

// Admin-facing click log filters (Reports → Click Logs).
export const clickLogFiltersSchema = z.object({
  offerId: z.string().uuid().optional(),
  affiliateId: z.string().uuid().optional(),
  qualityStatus: z.nativeEnum(ClickQualityStatus).optional(),
  countryCode: z.string().max(2).optional(),
  subId1: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  sortBy: z.enum(CLICK_SORT_FIELDS).default('createdAt'),
  sortDir: z.enum(['ASC', 'DESC']).default('DESC'),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(200).default(50),
  // Server-set from the session, never trusted from the query string (issue #5).
  ...managerScopeField,
});

export type ClickLogFiltersDto = z.infer<typeof clickLogFiltersSchema>;

/**
 * Where the click came from, at the full detail GeoLite2 gives.
 *
 * Its own interface because both the admin row and the affiliate row carry all of it:
 * a visitor's location is the affiliate's own traffic, and they need it to debug a
 * source. What separates the two rows is the *fraud reasoning* below — the registered
 * country, the ASN and the proxy traits — which is why those live on `ClickLogDto` and
 * not here. Keeping the split structural means a field added to the wrong interface is
 * a compile error rather than a leak nobody notices.
 */
export interface ClickGeoDto {
  countryCode: string | null;
  countryName: string | null;
  continentCode: string | null;
  continentName: string | null;
  city: string | null;
  cityGeonameId: number | null;
  region: string | null;
  regionCode: string | null;
  /** Second-level subdivision — a county or district, where MaxMind has one. */
  region2: string | null;
  region2Code: string | null;
  postalCode: string | null;
  latitude: number | null;
  longitude: number | null;
  /** MaxMind's confidence in the coordinates, in km. 1000 means "somewhere in this country". */
  accuracyRadiusKm: number | null;
  timeZone: string | null;
  metroCode: number | null;
  /** Pre-composed "City, ST, US" / "Local network" / "Unknown" — see click-log.service. */
  geoLabel: string;
}

export interface ClickLogDto extends ClickGeoDto {
  id: string;
  /** The number the advertiser saw as `click_id` — what a postback dispute quotes. */
  refId: number;
  offerId: string;
  affiliateId: string | null;
  ip: string;
  // The raw UA is the row-level detail behind the parsed device/os/browser — "why was
  // this scored that way" often comes down to the exact agent string.
  userAgent: string | null;
  deviceType: string | null;
  deviceBrand: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  asn: string | null;
  asnNumber: number | null;
  asnOrganization: string | null;
  /**
   * The country the address block is registered in.
   *
   * Network-side only, like the rest of this group: a mismatch against `countryCode` is
   * ordinary for a VPN and unusual for organic traffic, so it is a signal, and telling
   * the traffic source which signal caught them is how they learn to dodge it.
   */
  registeredCountryCode: string | null;
  /** MaxMind's own legacy traits — null when GeoLite2 does not set them, which is usual. */
  isAnonymousProxy: boolean | null;
  isSatelliteProvider: boolean | null;
  isDatacenter: boolean;
  isProxyOrVpn: boolean | null;
  isUnique: boolean;
  riskScore: number;
  qualityStatus: ClickQualityStatus;
  subId1: string | null;
  subId2: string | null;
  subId3: string | null;
  subId4: string | null;
  subId5: string | null;
  subId6: string | null;
  subId7: string | null;
  subId8: string | null;
  referer: string | null;
  createdAt: string;
}

/** Click-volume summary for the stat tiles, computed over the same filters as the list. */
export interface ClickSummaryDto {
  clicks: number;
  uniqueClicks: number;
}
