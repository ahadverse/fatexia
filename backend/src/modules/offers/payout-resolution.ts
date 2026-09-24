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

/**
 * What the conversion is worth, to the network and to the affiliate.
 *
 * The *rate* always comes from the rule — never from the postback. What an authenticated
 * advertiser may now supply is the **base** it is applied to: the revenue they are
 * actually paying for this particular sale. That is a deliberate narrowing of the old
 * money-integrity rule (PLAN-backend.md), not an abandonment of it, and the distinction
 * is the whole safeguard:
 *
 *  - A rule with a fixed payout stays fixed. Nothing an advertiser sends changes what
 *    the affiliate is owed; the reported figure only makes the network's own margin
 *    correct in reporting.
 *  - A percentage — the rule's own, or a smart-link's revenue share — is still *our*
 *    percentage. The advertiser can only say how large the sale was, never what slice
 *    of it the affiliate keeps.
 *
 * Without this, `rule.revenueAmount` was a single configured number standing in for
 * every sale on the offer, so a revenue share paid the same amount on a 5.00 order and
 * a 500.00 one — which is what made the share unusable on any real CPS offer.
 *
 * The reported figure is authenticated (secret + source-IP allowlist on /postback) and
 * stored alongside the computed amounts, so a conversion priced from a postback can
 * always be told apart from one priced from the rule.
 */
/**
 * What a conversion through an offer-less smart-link is worth.
 *
 * The same two ingredients as everywhere else — a rate and an amount — sourced
 * differently because there is no offer. The rate is the link's own revenue share, and
 * the amount is the sale the advertiser reported. Nothing here consults a payout rule,
 * because a link with no member offers has none to consult.
 *
 * The money-integrity split is unchanged and is the reason this is safe: the caller
 * supplies how large the sale was, the *link* supplies what share of it the affiliate
 * keeps, and the share is a number the network set on its own smart-link.
 *
 * Returns null when either ingredient is missing. A link with no share cannot price a
 * conversion at all, and refusing is the only honest answer — booking it at zero would
 * record a sale that paid nobody and look, in every report, like the affiliate earned
 * nothing rather than like the link was misconfigured.
 */
export function computeSmartLinkAmounts(
  revSharePercent: number | null,
  reportedRevenue: number | null,
): { revenueAmount: number; payoutAmount: number } | null {
  if (revSharePercent == null || !(revSharePercent > 0)) return null;
  if (reportedRevenue == null || !Number.isFinite(reportedRevenue) || !(reportedRevenue > 0)) return null;

  // Clamped at 100 for the same reason computeAmounts does it: above that the affiliate
  // is paid more than the advertiser paid, on every conversion, and the only symptom is
  // a margin going negative in a report someone has to happen to read.
  const percent = Math.min(revSharePercent, 100);
  return {
    revenueAmount: Number(reportedRevenue),
    payoutAmount: Number(((percent / 100) * Number(reportedRevenue)).toFixed(2)),
  };
}

export function computeAmounts(
  rule: PayoutRule,
  /**
   * A smart-link's revenue share, when the click came through one. Overrides the
   * rule's own payout with that percentage of the advertiser's revenue.
   *
   * Revenue is untouched either way: the share only decides how the advertiser's amount
   * is split with the affiliate.
   */
  revSharePercent?: number | null,
  /**
   * The sale value the advertiser reported on this conversion, when they sent one.
   *
   * Replaces the rule's configured revenue as the base for every percentage below.
   * Ignored when absent or not positive: a zero or missing figure must fall back to the
   * configured number rather than silently pricing the conversion at nothing.
   */
  reportedRevenue?: number | null,
): { revenueAmount: number; payoutAmount: number } {
  const useReported = reportedRevenue != null && Number.isFinite(reportedRevenue) && reportedRevenue > 0;
  const revenueAmount = useReported ? Number(reportedRevenue) : Number(rule.revenueAmount);
  const ruleAmount = Number(rule.amount);

  // A share of zero revenue is zero, which would silently pay nothing — so the
  // override only applies when there is a base to take a percentage of. Falling back
  // to the offer's own rule is the safer of the two wrong answers.
  if (revSharePercent != null && revSharePercent > 0 && revenueAmount > 0) {
    // Clamped at 100 even though the DTO already caps it there. This is the money
    // path: a share above 100% pays the affiliate more than the advertiser pays us, on
    // every conversion, and the only sign would be the margin going negative in a
    // report someone has to notice.
    const percent = Math.min(revSharePercent, 100);
    const sharePayout = Number(((percent / 100) * revenueAmount).toFixed(2));
    // A share so small it rounds to nothing (e.g. a link's rate left at a token
    // percentage) would otherwise book the sale at full revenue and zero payout —
    // taking 100% margin on paper while the affiliate who sent the traffic is paid
    // nothing, with no error anywhere to say why. Same "never silently zero" rule
    // computeSmartLinkAmounts already applies; here the fallback is the offer's own
    // rule rather than refusing outright, since one exists.
    if (sharePayout > 0) {
      return { revenueAmount, payoutAmount: sharePayout };
    }
  }

  const payoutAmount = rule.payoutType === PayoutType.PERCENTAGE ? Number(((ruleAmount / 100) * revenueAmount).toFixed(2)) : ruleAmount;
  return { revenueAmount, payoutAmount };
}
