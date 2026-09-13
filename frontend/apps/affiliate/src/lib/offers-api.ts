import type { AffiliateOffer } from '@fatexia/types';
import { apiFetch } from './api';

// GET /offers/available — every live offer, gated ones included, each carrying an
// `access` state. Payout-only projection, revenue/profit already zeroed server-side,
// and a locked offer arrives with trackingLink null (see toAffiliateOfferDto).
export function getAvailableOffers(): Promise<AffiliateOffer[]> {
  return apiFetch<AffiliateOffer[]>('/offers/available');
}

/**
 * The same list narrowed to what the affiliate can actually run.
 *
 * Browse is the only screen that wants the gated ones — it exists so they can be asked
 * about. Everywhere else (link builder, report filters) an offer they have no access to
 * is noise: it has no link to build and can never appear in their own numbers.
 */
export async function getRunnableOffers(): Promise<AffiliateOffer[]> {
  const offers = await getAvailableOffers();
  return offers.filter((offer) => offer.access === 'GRANTED');
}

// One offer, same projection as the list. Fetched rather than passed through router
// state so the detail URL survives a refresh and can be pasted to someone.
export function getAvailableOffer(offerId: string): Promise<AffiliateOffer> {
  return apiFetch<AffiliateOffer>(`/offers/available/${offerId}`);
}

// PUT, not a toggle POST: the click sends the state it wants, so a retry or a second
// tab converges instead of flipping the bookmark back.
export function setOfferFavourite(offerId: string, favourite: boolean): Promise<{ favourite: boolean }> {
  return apiFetch<{ favourite: boolean }>(`/offers/available/${offerId}/favourite`, {
    method: 'PUT',
    body: JSON.stringify({ favourite }),
  });
}
