import { redis } from '../../infra/redis/redis-client';
import { logger } from '../../common/logger';
import type { Offer } from '../offers/offer.entity';
import { computeAmounts, findMatchingRuleForClick, type MatchableClick } from '../offers/payout-resolution';
import type { PayoutRule } from '../offers/payout-rule.entity';
import { getOfferConversionRates } from './offer-cr-cache';
import { SmartLinkRotation, type SmartLink } from './smart-link.entity';

/**
 * Picks which member offer a smart-link click resolves to.
 *
 * Two gates run before rotation, and the order matters:
 *
 *  1. The **link's** own geo/device targeting — an all-or-nothing gate on the whole
 *     link. A visitor outside it gets the link's fallbackUrl; no member is considered.
 *  2. Each **member offer's** payout-rule targeting (issue #15's geo/device/OS). A
 *     member the visitor doesn't qualify for is dropped from the candidate list
 *     rather than being picked and then redirected to its own fallback — sending a
 *     visitor to an offer they can't convert on wastes the click and the rotation slot.
 *
 * Rotation then chooses among whatever survived. Every strategy is computed from data
 * already in hand (the payout rules loaded with the offers) or from a cache, so none
 * of them adds a query to the redirect.
 */
export interface SmartLinkCandidate {
  offer: Offer;
  rule: PayoutRule;
  payoutAmount: number;
}

// The link-level gate. Empty lists mean "no restriction", matching how the admin form
// presents them ("leave empty for all countries").
export function linkAcceptsVisitor(link: SmartLink, click: MatchableClick): boolean {
  if (link.countries.length > 0 && (!click.countryCode || !link.countries.includes(click.countryCode))) return false;
  if (link.devices.length > 0 && (!click.deviceType || !link.devices.includes(click.deviceType))) return false;
  return true;
}

/**
 * Narrows the members to the ones this visitor actually qualifies for, keeping each
 * one's matched rule so the rotation and the redirect both price the click from the
 * same rule rather than resolving it twice.
 */
export async function buildCandidates(
  offers: Offer[],
  click: MatchableClick,
  /**
   * The link's revenue share, when it has one.
   *
   * Required for TOP_PAYOUT to rank on what the click will actually pay. Without it the
   * ranking used each offer's own rule payout, which a revenue share overrides entirely:
   * on an 80% link, a member paying a flat 5 against 10.00 revenue was ranked above one
   * paying a flat 2 against 50.00 — while the real payouts are 8.00 and 40.00. The
   * rotation picked the worse offer, every time, and nothing downstream disagreed
   * because the redirect was then priced correctly from the same share.
   */
  revSharePercent?: number | null,
): Promise<SmartLinkCandidate[]> {
  const candidates: SmartLinkCandidate[] = [];
  for (const offer of offers) {
    if (!offer.destinationUrl) continue;
    const rule = await findMatchingRuleForClick(offer.payoutRules ?? [], click);
    if (!rule) continue;
    // No reported revenue here, and there cannot be: the sale has not happened yet. The
    // rule's configured revenue is the only estimate available at click time, so a
    // percentage member is ranked on its configured figure and then priced on the real
    // one at conversion. Ranking and pricing can therefore differ — which is correct,
    // not a drift to fix: a rotation cannot know a sale's size before the sale.
    candidates.push({ offer, rule, payoutAmount: computeAmounts(rule, revSharePercent).payoutAmount });
  }
  return candidates;
}

// Even split across candidates. Backed by a Redis counter rather than `Math.random()`
// so the split is actually even at low volume and stays even across tracker instances —
// two processes each rolling their own dice would drift.
async function roundRobinIndex(linkId: string, count: number): Promise<number> {
  try {
    const n = await redis.incr(`sl:rr:${linkId}`);
    return (n - 1) % count;
  } catch (err) {
    // Redis down: a uniform random pick is an even split in expectation, which is a
    // far better failure than dropping the click.
    logger.warn({ err, linkId }, 'Smart-link round-robin counter unavailable, picking at random');
    return Math.floor(Math.random() * count);
  }
}

/**
 * Weighted pick by recent conversion rate.
 *
 * Every candidate is floored at a tenth of the best performer's rate (or at an equal
 * share when no member has converted yet) so a new offer with no history still receives
 * traffic — without it, an offer that starts at 0% CR can never earn the clicks it would
 * need to prove otherwise.
 *
 * The floor is relative to the best rate rather than a fixed number so it keeps meaning
 * the same thing across links: a tenth of the winner is an exploration budget, where
 * "0.01" would be most of the traffic on one link and none of it on another.
 */
async function bestCrIndex(candidates: SmartLinkCandidate[]): Promise<number> {
  const rates = await getOfferConversionRates();
  const weights = candidates.map((candidate) => rates.get(candidate.offer.id) ?? 0);
  const floor = Math.max(...weights) > 0 ? Math.max(...weights) * 0.1 : 1;
  const floored = weights.map((weight) => Math.max(weight, floor));

  const total = floored.reduce((sum, weight) => sum + weight, 0);
  let roll = Math.random() * total;
  for (let i = 0; i < floored.length; i += 1) {
    roll -= floored[i]!;
    if (roll <= 0) return i;
  }
  return floored.length - 1;
}

export async function pickCandidate(link: SmartLink, candidates: SmartLinkCandidate[]): Promise<SmartLinkCandidate> {
  if (candidates.length === 1) return candidates[0]!;

  switch (link.rotation) {
    case SmartLinkRotation.TOP_PAYOUT:
      // Ties keep the first match, so a tied rotation is stable rather than jittering
      // between equal-paying members click to click.
      return candidates.reduce((best, candidate) => (candidate.payoutAmount > best.payoutAmount ? candidate : best));
    case SmartLinkRotation.ROUND_ROBIN:
      return candidates[await roundRobinIndex(link.id, candidates.length)]!;
    case SmartLinkRotation.BEST_CR:
      return candidates[await bestCrIndex(candidates)]!;
  }
}
