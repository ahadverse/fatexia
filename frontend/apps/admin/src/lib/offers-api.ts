import type { CreateOfferInput, Offer, OfferStatus } from '@fatexia/types';
import { apiFetch } from './api';

export function getOffers(): Promise<Offer[]> {
  return apiFetch<Offer[]>('/offers');
}

export function getOffer(id: string): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}`);
}

export function createOffer(input: CreateOfferInput): Promise<Offer> {
  return apiFetch<Offer>('/offers', { method: 'POST', body: JSON.stringify(input) });
}

export function updateOffer(id: string, input: CreateOfferInput): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}`, { method: 'PATCH', body: JSON.stringify(input) });
}

export function updateOfferStatus(id: string, status: OfferStatus): Promise<Offer> {
  return apiFetch<Offer>(`/offers/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
}

export function uploadOfferThumbnail(file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append('image', file);
  return apiFetch<{ url: string }>('/uploads/offer-thumbnail', { method: 'POST', body: formData });
}
