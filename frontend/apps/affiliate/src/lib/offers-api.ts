import type { AffiliateOffer } from '@fatexia/types';
import { apiFetch } from './api';

// GET /offers/available — payout-only projection, revenue/profit already zeroed
// server-side (see backend/src/modules/offers/offer.dto.ts toAffiliateOfferDto).
export function getAvailableOffers(): Promise<AffiliateOffer[]> {
  return apiFetch<AffiliateOffer[]>('/offers/available');
}
