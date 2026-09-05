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
export async function buildCandidates(offers: Offer[], click: MatchableClick): Promise<SmartLinkCandidate[]> {
  const candidates: SmartLinkCandidate[] = [];
  for (const offer of offers) {
    if (!offer.destinationUrl) continue;
    const rule = await findMatchingRuleForClick(offer.payoutRules ?? [], click);
    if (!rule) continue;
    candidates.push({ offer, rule, payoutAmount: computeAmounts(rule).payoutAmount });
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
 * Every candidate gets a floor of the weakest non-zero rate (or an equal share when no
 * member has converted yet) so a new offer with no history still receives traffic —
 * without it, an offer that starts at 0% CR can never earn the clicks it would need to
 * prove otherwise.
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
