import { z } from 'zod';
import type { NetworkSetting } from './network-setting.entity';

// Nullable, not just optional: this endpoint receives back the very DTO it emits, and
// that DTO uses null for "not set". Accepting only `undefined` would reject a
// round-trip save of an untouched form. Empty string is normalized to null so a
// cleared input actually clears the stored value.
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value ? value : null));

const nullableEmail = z
  .union([z.string().trim().email(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

// Validated as a real URL, unlike the free-text fields: this value is handed straight
// to a 302 Location header, so a malformed one would break the redirect for exactly
// the traffic nobody is watching.
const nullableUrl = z
  .union([z.string().trim().url().max(500), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value ? value : null));

export const updateNetworkSettingsSchema = z
  .object({
    networkName: z.string().trim().min(1).max(120).optional(),
    supportEmail: nullableEmail,
    defaultCurrency: z.string().trim().length(3).optional(),
    timezone: z.string().trim().max(60).optional(),
    defaultHoldDays: z.number().int().min(0).max(365).optional(),
    minimumPayoutThreshold: z.coerce.number().nonnegative().optional(),
    payoutCycleDays: z.number().int().min(1).max(365).optional(),
    autoApproveAffiliates: z.boolean().optional(),
    autoApproveConversions: z.boolean().optional(),
    pointsPerConversion: z.number().int().min(0).max(10000).optional(),
    fraudSuspectThreshold: z.number().int().min(0).max(100).optional(),
    fraudBlockThreshold: z.number().int().min(0).max(100).optional(),
    blockedRedirectUrl: nullableUrl,
    loginRateLimitPerMinute: z.number().int().min(1).max(1000).optional(),
    clickRateLimitPerMinute: z.number().int().min(1).max(100000).optional(),
    senderEmail: nullableEmail,
    senderName: nullableText(160),
  })
  // A suspect band at or above the block band would collapse the middle "hold for
  // review" tier entirely — every suspect click would be blocked outright.
  .refine(
    (dto) =>
      dto.fraudSuspectThreshold === undefined ||
      dto.fraudBlockThreshold === undefined ||
      dto.fraudSuspectThreshold < dto.fraudBlockThreshold,
    { message: 'fraudSuspectThreshold must be below fraudBlockThreshold', path: ['fraudSuspectThreshold'] },
  );

export type UpdateNetworkSettingsDto = z.infer<typeof updateNetworkSettingsSchema>;

export interface NetworkSettingsDto {
  networkName: string;
  supportEmail: string | null;
  defaultCurrency: string;
  timezone: string;
  defaultHoldDays: number;
  minimumPayoutThreshold: number;
  payoutCycleDays: number;
  autoApproveAffiliates: boolean;
  autoApproveConversions: boolean;
  pointsPerConversion: number;
  fraudSuspectThreshold: number;
  fraudBlockThreshold: number;
  blockedRedirectUrl: string | null;
  loginRateLimitPerMinute: number;
  clickRateLimitPerMinute: number;
  senderEmail: string | null;
  senderName: string | null;
  updatedAt: string;
}

export function toNetworkSettingsDto(settings: NetworkSetting): NetworkSettingsDto {
  return {
    networkName: settings.networkName,
    supportEmail: settings.supportEmail,
    defaultCurrency: settings.defaultCurrency,
    timezone: settings.timezone,
    defaultHoldDays: settings.defaultHoldDays,
    minimumPayoutThreshold: Number(settings.minimumPayoutThreshold),
    payoutCycleDays: settings.payoutCycleDays,
    autoApproveAffiliates: settings.autoApproveAffiliates,
    autoApproveConversions: settings.autoApproveConversions,
    pointsPerConversion: settings.pointsPerConversion,
    fraudSuspectThreshold: settings.fraudSuspectThreshold,
    fraudBlockThreshold: settings.fraudBlockThreshold,
    blockedRedirectUrl: settings.blockedRedirectUrl,
    loginRateLimitPerMinute: settings.loginRateLimitPerMinute,
    clickRateLimitPerMinute: settings.clickRateLimitPerMinute,
    senderEmail: settings.senderEmail,
    senderName: settings.senderName,
    updatedAt: settings.updatedAt.toISOString(),
  };
}
