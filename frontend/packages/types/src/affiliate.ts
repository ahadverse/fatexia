import type { UserStatus } from './user';

export type AffiliateMessenger = 'TELEGRAM' | 'SKYPE' | 'WHATSAPP';
export type AffiliatePayoutMethod = 'BANK_TRANSFER' | 'PAYPAL' | 'CRYPTO';

export const PAYOUT_METHOD_LABELS: Record<AffiliatePayoutMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  PAYPAL: 'PayPal',
  CRYPTO: 'Cryptocurrency',
};

/**
 * Supported crypto payout rails — mirrors `CRYPTO_CURRENCIES` in the Backend's
 * `affiliate.dto.ts`, which is the authority that validates them.
 *
 * Coin and network are separate because a wallet address is only valid on the chain
 * it was issued for: paying an ERC-20 address over TRON loses the funds outright, so
 * neither portal is allowed to collect one without the other.
 */
export const CRYPTO_CURRENCIES: { code: string; label: string; networks: string[] }[] = [
  { code: 'USDT', label: 'Tether (USDT)', networks: ['TRC20', 'ERC20', 'BEP20'] },
  { code: 'USDC', label: 'USD Coin (USDC)', networks: ['ERC20', 'TRC20', 'BEP20', 'SOL'] },
  { code: 'BTC', label: 'Bitcoin (BTC)', networks: ['BTC'] },
  { code: 'ETH', label: 'Ethereum (ETH)', networks: ['ERC20'] },
  { code: 'LTC', label: 'Litecoin (LTC)', networks: ['LTC'] },
  { code: 'TRX', label: 'TRON (TRX)', networks: ['TRC20'] },
];

export function networksFor(code: string): string[] {
  return CRYPTO_CURRENCIES.find((entry) => entry.code === code)?.networks ?? [];
}

/** Shape stored in `payoutDetails` when `payoutMethod` is CRYPTO. */
export interface CryptoPayoutDetails {
  cryptoCurrency: string;
  cryptoNetwork: string;
  walletAddress: string;
}

export function readCryptoDetails(details: Record<string, unknown> | undefined): CryptoPayoutDetails {
  return {
    cryptoCurrency: typeof details?.cryptoCurrency === 'string' ? details.cryptoCurrency : '',
    cryptoNetwork: typeof details?.cryptoNetwork === 'string' ? details.cryptoNetwork : '',
    walletAddress: typeof details?.walletAddress === 'string' ? details.walletAddress : '',
  };
}

/** One-line summary of a payout method for tables and read-only rows. */
export function describePayout(
  method: AffiliatePayoutMethod | null,
  details: Record<string, unknown> | undefined,
): string {
  if (!method) return 'Not set';
  if (method !== 'CRYPTO') return PAYOUT_METHOD_LABELS[method];
  const crypto = readCryptoDetails(details);
  if (!crypto.cryptoCurrency) return PAYOUT_METHOD_LABELS.CRYPTO;
  return `${crypto.cryptoCurrency}${crypto.cryptoNetwork ? ` · ${crypto.cryptoNetwork}` : ''}`;
}

export interface Affiliate {
  id: string;
  userId: string;
  email: string;
  // Lives on the linked user account server-side — one source of truth, so the login
  // gate and this list can never disagree.
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

export interface CreateAffiliateInput {
  email: string;
  password: string;
  fullName: string;
  country: string;
  messengerType?: AffiliateMessenger;
  messengerHandle?: string;
  trafficSources?: string[];
  verticals?: string[];
  websiteUrl?: string;
  companyName?: string;
  phone?: string;
  monthlyVolume?: string;
  referralSource?: string;
  notes?: string;
  postbackUrl?: string;
  assignedManagerId?: string | null;
  referredByAffiliateId?: string | null;
  payoutMethod?: AffiliatePayoutMethod | null;
  payoutDetails?: Record<string, unknown>;
  status?: UserStatus;
}

export type UpdateAffiliateInput = Partial<Omit<CreateAffiliateInput, 'email' | 'password' | 'status'>>;

export interface AffiliateGroup {
  id: string;
  name: string;
  description: string | null;
  affiliateIds: string[];
  memberCount: number;
  createdAt: string;
}

export interface CreateAffiliateGroupInput {
  name: string;
  description?: string;
  affiliateIds?: string[];
}

export interface AffiliatePoint {
  id: string;
  affiliateId: string;
  conversionId: string | null;
  points: number;
  reason: string;
  createdAt: string;
}

export interface AffiliatePointBalance {
  affiliateId: string;
  affiliateName: string | null;
  email: string;
  totalPoints: number;
  entryCount: number;
}
