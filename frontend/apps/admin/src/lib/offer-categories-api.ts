import type { OfferCategory } from '@fatexia/types';
import { apiFetch } from './api';

export function getOfferCategories(): Promise<OfferCategory[]> {
  return apiFetch<OfferCategory[]>('/offer-categories');
}

export function createOfferCategory(name: string): Promise<OfferCategory> {
  return apiFetch<OfferCategory>('/offer-categories', { method: 'POST', body: JSON.stringify({ name }) });
}
