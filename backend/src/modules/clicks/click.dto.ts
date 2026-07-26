import { z } from 'zod';
import { ClickQualityStatus } from './click.entity';

// Sub-ids are affiliate-controlled free text on a public endpoint — length-capped so
// a crafted link can't push oversized values into the click row.
const subId = z.string().max(255).optional();

export const clickQuerySchema = z.object({
  offerId: z.string().uuid(),
  affiliateId: z.string().uuid().optional(),
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
});

export type ClickLogFiltersDto = z.infer<typeof clickLogFiltersSchema>;

export interface ClickLogDto {
  id: string;
  offerId: string;
  affiliateId: string | null;
  ip: string;
  // The raw UA is the row-level detail behind the parsed device/os/browser — "why was
  // this scored that way" often comes down to the exact agent string.
  userAgent: string | null;
  countryCode: string | null;
  city: string | null;
  region: string | null;
  regionCode: string | null;
  /** Pre-composed "City, ST, US" / "Local network" / "Unknown" — see click-log.service. */
  geoLabel: string;
  deviceType: string | null;
  deviceBrand: string | null;
  os: string | null;
  osVersion: string | null;
  browser: string | null;
  browserVersion: string | null;
  asn: string | null;
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
