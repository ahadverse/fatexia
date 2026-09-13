import type { AffiliateOffer, AffiliatePayoutRule } from '@fatexia/types';
import { money } from './format';

/**
 * How an offer's payout rules read as one line.
 *
 * An offer can carry several rules — one per geo, device or dedicated affiliate — and
 * the list has a single cell for all of them. These helpers are shared with the detail
 * page so a row and the page it opens can never summarize the same offer differently.
 */

/**
 * The union of one targeting field across every payout rule.
 *
 * A rule with an empty list is unrestricted on that field, and one unrestricted rule
 * makes the whole offer unrestricted — so an empty result means "all", not "none".
 * Returning [] for that case lets the caller label it.
 */
export function targetingUnion(offer: AffiliateOffer, field: 'countries' | 'devices' | 'os'): string[] {
  const rules = offer.payoutRules;
  if (rules.length === 0) return [];
  if (rules.some((rule) => rule[field].length === 0)) return [];
  return [...new Set(rules.flatMap((rule) => rule[field]))];
}

// A percentage payout is a share of the sale, not an amount in the offer's currency —
// formatting it as money would read as a flat fee.
export function payoutAmountLabel(rule: AffiliatePayoutRule, currency: string): string {
  return rule.payoutType === 'PERCENTAGE' ? `${rule.amount.toFixed(2)}%` : money(rule.amount, currency);
}

/**
 * Every distinct payout an offer pays, in rule order.
 *
 * Distinct, not one per rule: an offer with eight geo rules at the same $2.00 pays
 * $2.00, and printing it eight times says nothing. Two real tiers still show as two.
 */
export function payoutLabels(offer: AffiliateOffer): string[] {
  return [...new Set(offer.payoutRules.map((rule) => payoutAmountLabel(rule, offer.currency)))];
}

/**
 * The conversion models an offer pays on — CPL, CPA, CPI, CPS, CPC.
 *
 * This is the closest thing the schema has to a "goal": there is no named-goal table,
 * so what an affiliate is being paid for is exactly the payout mode. Labelled as the
 * model rather than the goal, because calling it a goal would promise names it cannot
 * deliver.
 */
export function payoutModes(offer: AffiliateOffer): string[] {
  return [...new Set(offer.payoutRules.map((rule) => rule.payoutMode))];
}
