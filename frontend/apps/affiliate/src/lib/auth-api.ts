import type { PublicUser, TokenPair } from '@fatexia/types';
import { apiFetch, setTokens, clearTokens } from './api';

export async function login(email: string, password: string): Promise<PublicUser> {
  const tokens = await apiFetch<TokenPair>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  setTokens(tokens);
  return apiFetch<PublicUser>('/auth/me');
}

export function getMe(): Promise<PublicUser> {
  return apiFetch<PublicUser>('/auth/me');
}

export function logout(): void {
  clearTokens();
}

export type MessengerType = 'TELEGRAM' | 'SKYPE' | 'WHATSAPP';

export interface RegisterPayload {
  email: string;
  password: string;
  fullName: string;
  country: string;
  messengerType: MessengerType;
  messengerHandle: string;
  trafficSources: string[];
  websiteUrl?: string;
  companyName?: string;
  phone?: string;
  verticals?: string[];
  monthlyVolume?: string;
  referralSource?: string;
  /** Another affiliate's referral code — also decides which manager they land under. */
  referralCode?: string;
  notes?: string;
}

// Self-registration lands PENDING — the account exists but cannot sign in until an
// admin approves it, so this deliberately does not store tokens.
export function registerAffiliate(payload: RegisterPayload) {
  return apiFetch<{ id: string; email: string; status: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function verifyEmail(email: string, code: string) {
  return apiFetch<{ verified: true }>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ email, code }),
  });
}

export function resendVerification(email: string) {
  return apiFetch<{ sent: true }>('/auth/resend-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Always resolves, whether or not the address is registered — the backend answers
 * identically on purpose so this endpoint cannot be used to discover accounts. The UI
 * has to say "if that address is registered…" rather than "sent", or it gives away
 * what the API deliberately withholds.
 */
export function forgotPassword(email: string) {
  return apiFetch<{ sent: true }>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export function resetPassword(token: string, password: string) {
  return apiFetch<{ reset: true }>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
}
