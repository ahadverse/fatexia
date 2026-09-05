import { affiliateGroupRepository } from '../affiliate-groups/affiliate-group.repository';
import { PayoutType, type PayoutRule, type PayoutRuleTargeting } from './payout-rule.entity';

/**
 * Shared between the Tracker's click-time routing (click.service.ts) and the
 * postback's conversion-time pricing (postback.service.ts) — both need "which payout
 * rule applies to this traffic", just at different moments and for different purposes
 * (routing vs. pricing). Extracted so the matching logic can't drift between the two.
 */

// A click hasn't been written as a Click entity yet at the point click.service.ts
// needs to match it (that's the whole reason routing happens before the insert), so
// this is the minimal shape both callers can supply — a real Click satisfies it too.
export interface MatchableClick {
  countryCode: string | null;
  deviceType: string | null;
  os: string | null;
  affiliateId: string | null;
}

export function isWildcardTargeting(t: PayoutRuleTargeting): boolean {
  return t.countries.length === 0 && t.devices.length === 0 && (t.os ?? []).length === 0 && t.affiliateIds.length === 0 && t.affiliateGroupIds.length === 0;
}

function isWildcardRule(r: PayoutRule): boolean {
  return isWildcardTargeting(r.targeting);
}

export function ruleMatchesClick(t: PayoutRuleTargeting, click: MatchableClick, affiliateGroupIds: string[]): boolean {
  if (t.countries.length > 0 && (!click.countryCode || !t.countries.includes(click.countryCode))) return false;
  if (t.devices.length > 0 && (!click.deviceType || !t.devices.includes(click.deviceType))) return false;
  if ((t.os ?? []).length > 0 && (!click.os || !(t.os ?? []).includes(click.os))) return false;
  if (t.affiliateIds.length > 0 && (!click.affiliateId || !t.affiliateIds.includes(click.affiliateId))) return false;
  if (t.affiliateGroupIds.length > 0 && !t.affiliateGroupIds.some((gid) => affiliateGroupIds.includes(gid))) return false;
  return true;
}

// Only queried when some rule actually targets a group — the common case (no
// affiliate-group targeting anywhere on the offer) skips the lookup entirely.
export async function resolveAffiliateGroupIds(rules: PayoutRule[], affiliateId: string | null): Promise<string[]> {
  const needsGroupCheck = !!affiliateId && rules.some((r) => r.targeting.affiliateGroupIds.length > 0);
  if (!needsGroupCheck) return [];
  const groups = await affiliateGroupRepository.findAll();
  return groups.filter((g) => g.affiliateIds.includes(affiliateId!)).map((g) => g.id);
}

/**
 * Picks the payout rule that PRICES a conversion. An orphan postback (no matching
 * click) has nothing to target against, so it falls back to the offer's untargeted
 * rule if it has one. A rule with no matching target at all still falls back rather
 * than leaving the conversion unpriced — every offer requires at least one payout rule
 * to exist (see OfferForm), so `rules` is never empty in practice.
 *
 * This is deliberately more forgiving than findMatchingRuleForClick below: pricing
 * something is always better than pricing nothing, but *routing* a click nowhere the
 * admin configured is exactly the case fallbackUrl exists for — so click-time routing
 * does NOT fall back to "first rule" the way this does.
 */
// The offer's "default" rule absent any click context — the wildcard (untargeted)
// rule if one exists, else whichever rule was added first. Used both for orphan
// postbacks below and for the Offers list's payout column (issue #16 — that column
// used to read a separate, easily-forgotten `defaultPayoutAmount` field instead of the
// payout rules actually configured).
export function pickRepresentativeRule(rules: PayoutRule[]): PayoutRule | null {
  if (rules.length === 0) return null;
  return rules.find(isWildcardRule) ?? rules[0]!;
}

export async function resolvePayoutRuleForPricing(rules: PayoutRule[], click: MatchableClick | null): Promise<PayoutRule | null> {
  if (!click) {
    return pickRepresentativeRule(rules);
  }
  if (rules.length === 0) return null;
  const affiliateGroupIds = await resolveAffiliateGroupIds(rules, click.affiliateId);
  const matching = rules.find((r) => ruleMatchesClick(r.targeting, click, affiliateGroupIds));
  return matching ?? pickRepresentativeRule(rules);
}

// Click-time routing: a genuine match only, no last-resort fallback to "first rule" —
// a wildcard rule (empty targeting) matches everything by definition, so this only
// returns null when every rule on the offer has real targeting and none of it fits
// this click. That null is exactly when the caller should use the offer's fallbackUrl.
export async function findMatchingRuleForClick(rules: PayoutRule[], click: MatchableClick): Promise<PayoutRule | null> {
  const affiliateGroupIds = await resolveAffiliateGroupIds(rules, click.affiliateId);
  return rules.find((r) => ruleMatchesClick(r.targeting, click, affiliateGroupIds)) ?? null;
}

// Both amounts always come from the rule, never from the postback payload (money
// integrity rule, PLAN-backend.md). PERCENTAGE payoutType applies the rule's own
// percentage against the rule's own revenueAmount — no externally-reported sale value
// is ever consulted, so there is nothing here an advertiser could inflate.
export function computeAmounts(rule: PayoutRule): { revenueAmount: number; payoutAmount: number } {
  const revenueAmount = Number(rule.revenueAmount);
  const ruleAmount = Number(rule.amount);
  const payoutAmount = rule.payoutType === PayoutType.PERCENTAGE ? Number(((ruleAmount / 100) * revenueAmount).toFixed(2)) : ruleAmount;
  return { revenueAmount, payoutAmount };
}
