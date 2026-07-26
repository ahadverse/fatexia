import type { Advertiser, AdvertiserStatus, CreateAdvertiserInput } from '@fatexia/types';
import { apiFetch } from './api';
import { toQuery } from './query';

export interface AdvertiserFilters {
  status?: AdvertiserStatus | '';
  country?: string;
  accountManagerId?: string;
  search?: string;
}

export function getAdvertisers(filters: AdvertiserFilters = {}): Promise<Advertiser[]> {
  return apiFetch<Advertiser[]>(`/advertisers${toQuery({ ...filters })}`);
}

export function getAdvertiser(id: string): Promise<Advertiser> {
  return apiFetch<Advertiser>(`/advertisers/${id}`);
}

export function createAdvertiser(input: CreateAdvertiserInput): Promise<Advertiser> {
  return apiFetch<Advertiser>('/advertisers', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdvertiser(id: string, input: Partial<CreateAdvertiserInput>): Promise<Advertiser> {
  return apiFetch<Advertiser>(`/advertisers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateAdvertiserStatus(id: string, status: AdvertiserStatus): Promise<Advertiser> {
  return apiFetch<Advertiser>(`/advertisers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}
