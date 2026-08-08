import { z } from 'zod';
import { UserStatus } from '../users/user.entity';
import { AffiliateMessenger, AffiliatePayoutMethod, type Affiliate } from './affiliate.entity';

export const affiliateFiltersSchema = z.object({
  status: z.nativeEnum(UserStatus).optional(),
  country: z.string().optional(),
  assignedManagerId: z.string().uuid().optional(),
  referredByAffiliateId: z.string().uuid().optional(),
  search: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
});

export type AffiliateFiltersDto = z.infer<typeof affiliateFiltersSchema>;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .or(z.literal('').transform(() => undefined));

/**
 * Supported crypto payout rails.
 *
 * A closed list, mirrored on both portals, because a wallet address is only valid on
 * the chain it was issued for — "USDT" alone is not a payable instruction, and paying
 * an ERC-20 address over TRON loses the money with no recourse. Coin *and* network
 * are therefore both required, and the pair is validated against this list rather
 * than accepted as free text.
 */
export const CRYPTO_CURRENCIES = [
  { code: 'USDT', label: 'Tether (USDT)', networks: ['TRC20', 'ERC20', 'BEP20'] },
  { code: 'USDC', label: 'USD Coin (USDC)', networks: ['ERC20', 'TRC20', 'BEP20', 'SOL'] },
  { code: 'BTC', label: 'Bitcoin (BTC)', networks: ['BTC'] },
  { code: 'ETH', label: 'Ethereum (ETH)', networks: ['ERC20'] },
  { code: 'LTC', label: 'Litecoin (LTC)', networks: ['LTC'] },
  { code: 'TRX', label: 'TRON (TRX)', networks: ['TRC20'] },
] as const;

export type CryptoCurrencyCode = (typeof CRYPTO_CURRENCIES)[number]['code'];

const cryptoDetailsSchema = z.object({
  cryptoCurrency: z.string().trim().min(1),
  cryptoNetwork: z.string().trim().min(1),
  // Deliberately a length/charset check, not per-chain address validation: a wrong
  // but well-formed address is indistinguishable here, and a too-strict regex would
  // reject valid formats the moment a chain changes its encoding.
  walletAddress: z
    .string()
    .trim()
    .min(16)
    .max(120)
    .regex(/^[a-zA-Z0-9:_-]+$/, 'Wallet address contains characters no supported chain uses'),
});

/**
 * Cross-field guard: crypto payout details are only checked when crypto is the
 * chosen method, so switching to bank transfer doesn't demand a wallet address.
 *
 * Applied to every schema that can set a payout method, so an affiliate cannot save
 * a half-configured crypto payout through self-service that the admin form would
 * have rejected.
 */
function withCryptoPayoutCheck<T extends z.ZodTypeAny>(schema: T): z.ZodEffects<T> {
  return schema.superRefine((value, ctx) => {
    const dto = value as { payoutMethod?: AffiliatePayoutMethod | null; payoutDetails?: Record<string, unknown> };
    if (dto.payoutMethod !== AffiliatePayoutMethod.CRYPTO) return;

    const parsed = cryptoDetailsSchema.safeParse(dto.payoutDetails ?? {});
    if (!parsed.success) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payoutDetails'],
        message: 'Crypto payouts need a currency, a network and a wallet address',
      });
      return;
    }

    const currency = CRYPTO_CURRENCIES.find((entry) => entry.code === parsed.data.cryptoCurrency);
    if (!currency) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payoutDetails', 'cryptoCurrency'],
        message: `Unsupported currency. Supported: ${CRYPTO_CURRENCIES.map((entry) => entry.code).join(', ')}`,
      });
      return;
    }

    if (!(currency.networks as readonly string[]).includes(parsed.data.cryptoNetwork)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['payoutDetails', 'cryptoNetwork'],
        message: `${currency.code} is not payable on ${parsed.data.cryptoNetwork}. Supported: ${currency.networks.join(', ')}`,
      });
    }
  });
}

// Admin-provisioned affiliate: creates the login and the profile in one transaction.
// Unlike self-registration this lands ACTIVE by default — an admin creating an
// account has already vetted it.
// Kept as a plain object so `updateAffiliateSchema` can still .omit()/.partial() it —
// the crypto refinement is applied to each exported schema below, not to the base.
const createAffiliateBaseSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(255),
  fullName: z.string().trim().min(2).max(120),
  country: z.string().trim().min(2).max(80),
  messengerType: z.nativeEnum(AffiliateMessenger).optional(),
  messengerHandle: optionalText(120),
  trafficSources: z.array(z.string()).default([]),
  verticals: z.array(z.string()).default([]),
  websiteUrl: optionalText(255),
  companyName: optionalText(120),
  phone: optionalText(40),
  monthlyVolume: optionalText(40),
  referralSource: optionalText(60),
  notes: optionalText(1000),
  postbackUrl: optionalText(500),
  assignedManagerId: z.string().uuid().optional().nullable(),
  referredByAffiliateId: z.string().uuid().optional().nullable(),
  payoutMethod: z.nativeEnum(AffiliatePayoutMethod).optional().nullable(),
  payoutDetails: z.record(z.unknown()).default({}),
  status: z.nativeEnum(UserStatus).default(UserStatus.ACTIVE),
});

export const createAffiliateSchema = withCryptoPayoutCheck(createAffiliateBaseSchema);

export type CreateAffiliateDto = z.infer<typeof createAffiliateSchema>;

// Email/password are not editable here — a credential change goes through the
// dedicated password route so it can't ride along in a profile save.
export const updateAffiliateSchema = withCryptoPayoutCheck(
  createAffiliateBaseSchema.omit({ email: true, password: true, status: true }).partial(),
);

export type UpdateAffiliateDto = z.infer<typeof updateAffiliateSchema>;

export const updateAffiliateStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
});

export type UpdateAffiliateStatusDto = z.infer<typeof updateAffiliateStatusSchema>;

// Self-service: an affiliate can edit their own contact details and postback URL but
// never their manager assignment, referrer, or account status (PLAN-backend.md).
export const updateOwnProfileSchema = withCryptoPayoutCheck(
  z.object({
    fullName: z.string().trim().min(2).max(120).optional(),
    country: z.string().trim().min(2).max(80).optional(),
    messengerType: z.nativeEnum(AffiliateMessenger).optional(),
    messengerHandle: optionalText(120),
    websiteUrl: optionalText(255),
    companyName: optionalText(120),
    phone: optionalText(40),
    postbackUrl: optionalText(500),
    payoutMethod: z.nativeEnum(AffiliatePayoutMethod).optional().nullable(),
    payoutDetails: z.record(z.unknown()).optional(),
  }),
);

export type UpdateOwnProfileDto = z.infer<typeof updateOwnProfileSchema>;

export interface AffiliateDto {
  id: string;
  userId: string;
  email: string;
  status: UserStatus;
  fullName: string | null;
  emailVerified: boolean;
  country: string | null;
  messengerType: AffiliateMessenger | null;
  messengerHandle: string | null;
  trafficSources: string[];
  verticals: string[];
  websiteUrl: string | null;
  companyName: string | null;
  phone: string | null;
  monthlyVolume: string | null;
  referralSource: string | null;
  notes: string | null;
  postbackUrl: string | null;
  referredByAffiliateId: string | null;
  referralCode: string | null;
  assignedManagerId: string | null;
  payoutMethod: AffiliatePayoutMethod | null;
  payoutDetails: Record<string, unknown>;
  lastLogin: string | null;
  createdAt: string;
}

// Status lives on the linked user account, not on the affiliate row — a single
// source of truth, so blocking the login and suspending the affiliate can't diverge.
export function toAffiliateDto(affiliate: Affiliate): AffiliateDto {
  return {
    id: affiliate.id,
    userId: affiliate.userId,
    email: affiliate.user?.email ?? '',
    status: affiliate.user?.status ?? UserStatus.PENDING,
    fullName: affiliate.fullName,
    emailVerified: Boolean(affiliate.user?.emailVerifiedAt),
    country: affiliate.country,
    messengerType: affiliate.messengerType,
    messengerHandle: affiliate.messengerHandle,
    trafficSources: affiliate.trafficSources ?? [],
    verticals: affiliate.verticals ?? [],
    websiteUrl: affiliate.websiteUrl,
    companyName: affiliate.companyName,
    phone: affiliate.phone,
    monthlyVolume: affiliate.monthlyVolume,
    referralSource: affiliate.referralSource,
    notes: affiliate.notes,
    postbackUrl: affiliate.postbackUrl,
    referredByAffiliateId: affiliate.referredByAffiliateId,
    referralCode: affiliate.referralCode,
    assignedManagerId: affiliate.assignedManagerId,
    payoutMethod: affiliate.payoutMethod,
    payoutDetails: affiliate.payoutDetails ?? {},
    lastLogin: affiliate.user?.lastLogin?.toISOString() ?? null,
    createdAt: affiliate.createdAt.toISOString(),
  };
}
