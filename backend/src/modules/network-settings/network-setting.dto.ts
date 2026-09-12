import { z } from 'zod';
import type { NetworkSetting } from './network-setting.entity';

// Nullable, not just optional: this endpoint receives back the very DTO it emits, and
// that DTO uses null for "not set". Accepting only `undefined` would reject a
// round-trip save of an untouched form. Empty string is normalized to null so a
// cleared input actually clears the stored value.
//
// `undefined`, though, is passed through untouched and never folded into `null`. This
// is a PATCH: the service persists any key that is not `undefined`, so collapsing
// "absent" into "null" makes a request that omits a field silently erase it — which is
// exactly how a single-field PATCH once wiped the stored support email.
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((value) => (value === undefined ? undefined : value ? value : null));

const nullableEmail = z
  .union([z.string().trim().email(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value : null));

// Validated as a real URL, unlike the free-text fields: this value is handed straight
// to a 302 Location header, so a malformed one would break the redirect for exactly
// the traffic nobody is watching.
const nullableUrl = z
  .union([z.string().trim().url().max(500), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === undefined ? undefined : value ? value : null));

export const updateNetworkSettingsSchema = z
  .object({
    networkName: z.string().trim().min(1).max(120).optional(),
    supportEmail: nullableEmail,
    // Handle only. A pasted "https://t.me/x" would be concatenated into the link the
    // portal builds and produce a dead URL, so the scheme and host are stripped here
    // rather than being caught later by whoever clicks it.
    supportTelegram: z
      .union([z.string().trim().max(120), z.literal(''), z.null()])
      .optional()
      .transform((value) => {
        if (value === undefined) return undefined;
        const handle = (value ?? '').trim().replace(/^https?:\/\/(t\.me|telegram\.me)\//i, '').replace(/^@/, '');
        return handle ? handle : null;
      }),
    // Free text, not an email: a Teams contact is given either way round — an address
    // to open a chat against, or a ready-made invite/channel link pasted from Teams
    // itself. Validating it as an email rejected the link form outright.
    supportTeams: nullableText(255),
    emailProvider: z.enum(['BREVO', 'MAILGUN']).optional(),
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
  supportTelegram: string | null;
  supportTeams: string | null;
  emailProvider: string;
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
    supportTelegram: settings.supportTelegram,
    supportTeams: settings.supportTeams,
    emailProvider: settings.emailProvider,
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
