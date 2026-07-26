const API_URL = process.env.NEXT_PUBLIC_API_URL as string;

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError((body as { error?: string }).error ?? 'Request failed', res.status);
  }
  return (await res.json()) as T;
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
  notes?: string;
}

export function registerAffiliate(payload: RegisterPayload) {
  return request<{ id: string; email: string; status: string }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function login(email: string, password: string) {
  return request<{ accessToken: string; refreshToken: string }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}
