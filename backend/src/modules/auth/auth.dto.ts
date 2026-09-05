import { z } from 'zod';
import { AffiliateMessenger } from '../affiliates/affiliate.entity';

// Closed lists shared with the public register form so the same options render and
// validate on both sides.
export const TRAFFIC_SOURCES = ['Facebook', 'Google', 'Native', 'Push', 'Pop', 'Email', 'SEO', 'Influencer'] as const;
export const AFFILIATE_VERTICALS = [
  'Finance',
  'Nutra & Health',
  'Sweepstakes',
  'Dating',
  'Mobile Content',
  'iGaming',
  'E-commerce',
  'Insurance',
  'Software & VPN',
  'Lead Gen',
] as const;
export const MONTHLY_VOLUMES = ['Just starting out', 'Under $1k / mo', '$1k-$10k / mo', '$10k-$50k / mo', '$50k+ / mo'] as const;
export const REFERRAL_SOURCES = ['Search engine', 'Social media', 'Affiliate forum', 'Friend or referral', 'Event or conference', 'Other'] as const;

// Optional enum-ish field: treat an empty string the same as "not provided".
const optionalEnum = <T extends readonly [string, ...string[]]>(values: T) => z.preprocess((v) => (v === '' ? undefined : v), z.enum(values).optional());
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

// Self-registration is affiliate-only for now — advertiser is deferred (see
// PLAN-backend.md), and ADMIN/MANAGER accounts are provisioned by an admin, not
// self-registered. Beyond credentials we capture a minimal affiliate profile so an
// admin has enough to vet the application (see the Affiliate entity).
export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(255),
  fullName: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(80),
  messengerType: z.nativeEnum(AffiliateMessenger),
  messengerHandle: z.string().trim().min(2).max(120),
  trafficSources: z.array(z.enum(TRAFFIC_SOURCES)).min(1, 'Select at least one traffic source'),
  // Optional promo/website URL. Empty string is coerced to undefined so a blank field
  // isn't rejected by the URL check.
  websiteUrl: z
    .string()
    .trim()
    .max(255)
    .url()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  // Optional profile detail — the more an applicant gives, the faster we can vet them.
  companyName: optionalText(120),
  phone: optionalText(40),
  verticals: z.array(z.enum(AFFILIATE_VERTICALS)).optional(),
  monthlyVolume: optionalEnum(MONTHLY_VOLUMES),
  referralSource: optionalEnum(REFERRAL_SOURCES),
  // An existing affiliate's referral code, if this applicant came in through one.
  // Drives both the referral commission split and, via issue #5, which manager the new
  // account lands under — a referred affiliate joins their referrer's manager rather
  // than the admin's unassigned pool. An unrecognised code is ignored rather than
  // rejected: a mistyped code should not block a legitimate application.
  referralCode: optionalText(40),
  notes: optionalText(1000),
});

export type RegisterDto = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export type LoginDto = z.infer<typeof loginSchema>;

export const refreshSchema = z.object({
  refreshToken: z.string().min(1),
});

export type RefreshDto = z.infer<typeof refreshSchema>;

export const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().trim().length(6).regex(/^\d{6}$/, 'Code must be 6 digits'),
});

export type VerifyEmailDto = z.infer<typeof verifyEmailSchema>;

export const resendVerificationSchema = z.object({
  email: z.string().email(),
});

export type ResendVerificationDto = z.infer<typeof resendVerificationSchema>;
