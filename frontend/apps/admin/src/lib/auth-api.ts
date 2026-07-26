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
