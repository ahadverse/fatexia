import type { TokenPair } from '@fatexia/types';

const API_URL = import.meta.env.VITE_API_URL as string;

const ACCESS_TOKEN_KEY = 'fatexia-affiliate-access-token';
const REFRESH_TOKEN_KEY = 'fatexia-affiliate-refresh-token';

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function setTokens(tokens: TokenPair): void {
  localStorage.setItem(ACCESS_TOKEN_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_TOKEN_KEY, tokens.refreshToken);
}

export function clearTokens(): void {
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function hasStoredSession(): boolean {
  return getAccessToken() !== null;
}

type Listener = () => void;
const invalidationListeners = new Set<Listener>();

// A 401 that survives a token refresh (refresh token itself is expired/invalid)
// can't reach SessionContext's state directly from inside apiFetch — it notifies
// via this subscription instead, same pattern as the Admin portal.
export function onSessionInvalidated(listener: Listener): () => void {
  invalidationListeners.add(listener);
  return () => invalidationListeners.delete(listener);
}

function notifySessionInvalidated(): void {
  clearTokens();
  invalidationListeners.forEach((listener) => listener());
}

async function doFetch(path: string, options: RequestInit): Promise<Response> {
  const accessToken = getAccessToken();
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(`${API_URL}${path}`, { ...options, headers });
}

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const res = await fetch(`${API_URL}/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!res.ok) return false;

  const tokens = (await res.json()) as TokenPair;
  setTokens(tokens);
  return true;
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  let res = await doFetch(path, options);

  if (res.status === 401 && getRefreshToken()) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      res = await doFetch(path, options);
    } else {
      notifySessionInvalidated();
    }
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError((body as { error?: string }).error ?? 'Request failed', res.status);
  }

  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}
