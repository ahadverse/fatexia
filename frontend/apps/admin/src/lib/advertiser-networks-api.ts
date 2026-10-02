import type { AdvertiserNetwork, AdvertiserNetworkInput } from '@fatexia/types';
import { apiFetch } from './api';

export function getAdvertiserNetworks(): Promise<AdvertiserNetwork[]> {
  return apiFetch<AdvertiserNetwork[]>('/advertiser-networks');
}

export function createAdvertiserNetwork(input: AdvertiserNetworkInput): Promise<AdvertiserNetwork> {
  return apiFetch<AdvertiserNetwork>('/advertiser-networks', { method: 'POST', body: JSON.stringify(input) });
}

export function updateAdvertiserNetwork(id: string, input: AdvertiserNetworkInput): Promise<AdvertiserNetwork> {
  return apiFetch<AdvertiserNetwork>(`/advertiser-networks/${id}`, { method: 'PUT', body: JSON.stringify(input) });
}

export function deleteAdvertiserNetwork(id: string): Promise<void> {
  return apiFetch<void>(`/advertiser-networks/${id}`, { method: 'DELETE' });
}
