import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Offer } from '../offers/offer.entity';
import { PayoutMode, PayoutType, RevenueModel, type PayoutRule, type PayoutRuleTargeting } from '../offers/payout-rule.entity';
import { SmartLinkRotation, SmartLinkStatus, type SmartLink } from './smart-link.entity';

import { buildCandidates, linkAcceptsVisitor, pickCandidate } from './smart-link-resolution';

/**
 * Redis and the CR snapshot are the only infrastructure this module touches. Stubbed
 * so rotation can be tested as logic — including the Redis-down path, which is
 * otherwise unreachable without stopping a real server.
 *
 * `vi.hoisted` because `vi.mock` is lifted above the imports (see the note in
 * payout-resolution.test.ts).
 */
const { incr, rates } = vi.hoisted(() => ({ incr: vi.fn(), rates: vi.fn() }));
vi.mock('../../infra/redis/redis-client', () => ({ redis: { incr } }));
vi.mock('./offer-cr-cache', () => ({ getOfferConversionRates: rates }));
vi.mock('../affiliate-groups/affiliate-group.repository', () => ({
  affiliateGroupRepository: { findAll: async () => [] },
}));

function targeting(overrides: Partial<PayoutRuleTargeting> = {}): PayoutRuleTargeting {
  return { countries: [], devices: [], os: [], affiliateIds: [], affiliateGroupIds: [], ...overrides };
}

function offer(id: string, amount: string, target: PayoutRuleTargeting = targeting()): Offer {
  const rule = {
    id: `${id}-rule`,
    offerId: id,
    payoutMode: PayoutMode.CPA,
    payoutType: PayoutType.FLAT,
    amount,
    revenueModel: RevenueModel.NONE,
    revenueAmount: '0.00',
    targeting: target,
    managerCommissionPercent: 0,
    referAffiliateCommissionPercent: 0,
    holdEnabled: false,
    holdDays: 0,
    commissionPercent: 0,
    createdAt: new Date(),
  } as PayoutRule;
  return { id, destinationUrl: `https://${id}.example.com/lp`, payoutRules: [rule] } as Offer;
}

function link(overrides: Partial<SmartLink> = {}): SmartLink {
  return {
    id: 'link-1',
    slug: 'test',
    countries: [],
    devices: [],
    rotation: SmartLinkRotation.TOP_PAYOUT,
    status: SmartLinkStatus.ACTIVE,
    fallbackUrl: null,
    offerIds: [],
    ...overrides,
  } as SmartLink;
}

const visitor = { countryCode: 'BR', deviceType: 'mobile', os: 'Android', affiliateId: 'aff-1' };

beforeEach(() => {
  incr.mockReset();
  rates.mockReset();
  rates.mockResolvedValue(new Map());
});

describe('linkAcceptsVisitor (the link-level gate)', () => {
  it('accepts everyone when the link is unrestricted', () => {
    expect(linkAcceptsVisitor(link(), visitor)).toBe(true);
  });

  it('gates on the link’s own geo and device', () => {
    expect(linkAcceptsVisitor(link({ countries: ['BR'] }), visitor)).toBe(true);
    expect(linkAcceptsVisitor(link({ countries: ['US'] }), visitor)).toBe(false);
    expect(linkAcceptsVisitor(link({ devices: ['mobile'] }), visitor)).toBe(true);
    expect(linkAcceptsVisitor(link({ devices: ['desktop'] }), visitor)).toBe(false);
  });

  // An unknown country is not "every country" — same rule as payout targeting.
  it('rejects an unknown geo against a targeted link', () => {
    expect(linkAcceptsVisitor(link({ countries: ['BR'] }), { ...visitor, countryCode: null })).toBe(false);
  });
});

describe('buildCandidates (the member-level gate)', () => {
  it('keeps members the visitor qualifies for, with their matched rule priced', async () => {
    const candidates = await buildCandidates([offer('a', '40.00'), offer('b', '90.00')], visitor);
    expect(candidates.map((c) => [c.offer.id, c.payoutAmount])).toEqual([
      ['a', 40],
      ['b', 90],
    ]);
  });

  /**
   * Dropping rather than picking-then-bouncing is the whole point: a member the
   * visitor cannot convert on would otherwise consume the rotation slot and send them
   * to that offer's fallback instead of to an offer that actually fits.
   */
  it('drops a member whose payout targeting excludes the visitor', async () => {
    const brazilOnly = offer('br', '50.00', targeting({ countries: ['BR'] }));
    const usOnly = offer('us', '99.00', targeting({ countries: ['US'] }));
    const candidates = await buildCandidates([brazilOnly, usOnly], visitor);
    expect(candidates.map((c) => c.offer.id)).toEqual(['br']);
  });

  it('drops a member with no destination URL', async () => {
    const draft = { ...offer('draft', '50.00'), destinationUrl: null } as Offer;
    await expect(buildCandidates([draft], visitor)).resolves.toEqual([]);
  });

  it('returns nothing when no member fits', async () => {
    const usOnly = offer('us', '99.00', targeting({ countries: ['US'] }));
    await expect(buildCandidates([usOnly], visitor)).resolves.toEqual([]);
  });
});

describe('pickCandidate', () => {
  it('short-circuits a single candidate without consulting Redis', async () => {
    const [only] = await buildCandidates([offer('a', '40.00')], visitor);
    await expect(pickCandidate(link({ rotation: SmartLinkRotation.ROUND_ROBIN }), [only!])).resolves.toBe(only);
    expect(incr).not.toHaveBeenCalled();
  });

  describe('TOP_PAYOUT', () => {
    it('picks the highest payout', async () => {
      const candidates = await buildCandidates([offer('a', '40.00'), offer('b', '90.00'), offer('c', '65.00')], visitor);
      const chosen = await pickCandidate(link(), candidates);
      expect(chosen.offer.id).toBe('b');
    });

    // Stable on ties, so equal-paying members don't jitter click to click.
    it('keeps the first of two equal payouts', async () => {
      const candidates = await buildCandidates([offer('a', '50.00'), offer('b', '50.00')], visitor);
      const chosen = await pickCandidate(link(), candidates);
      expect(chosen.offer.id).toBe('a');
    });
  });

  describe('ROUND_ROBIN', () => {
    it('advances through the members in order', async () => {
      const candidates = await buildCandidates([offer('a', '40.00'), offer('b', '90.00'), offer('c', '65.00')], visitor);
      const rotation = link({ rotation: SmartLinkRotation.ROUND_ROBIN });
      const picks: string[] = [];
      for (let n = 1; n <= 4; n += 1) {
        incr.mockResolvedValueOnce(n);
        picks.push((await pickCandidate(rotation, candidates)).offer.id);
      }
      // The counter is 1-based, so the first click takes index 0 — and the fourth
      // wraps back to the first member rather than falling off the end.
      expect(picks).toEqual(['a', 'b', 'c', 'a']);
    });

    it('still returns a member when Redis is down', async () => {
      const candidates = await buildCandidates([offer('a', '40.00'), offer('b', '90.00')], visitor);
      incr.mockRejectedValue(new Error('redis unavailable'));
      const chosen = await pickCandidate(link({ rotation: SmartLinkRotation.ROUND_ROBIN }), candidates);
      expect(candidates).toContain(chosen);
    });
  });

  describe('BEST_CR', () => {
    it('favours the better converter over many clicks', async () => {
      const candidates = await buildCandidates([offer('poor', '40.00'), offer('rich', '40.00')], visitor);
      rates.mockResolvedValue(new Map([['poor', 0.01], ['rich', 0.5]]));
      const rotation = link({ rotation: SmartLinkRotation.BEST_CR });

      const counts = { poor: 0, rich: 0 };
      for (let i = 0; i < 400; i += 1) {
        counts[(await pickCandidate(rotation, candidates)).offer.id as 'poor' | 'rich'] += 1;
      }
      expect(counts.rich).toBeGreaterThan(counts.poor);
    });

    /**
     * The weight floor exists so a brand-new member can earn the history it would
     * need to prove itself — without it, an offer sitting at 0% CR is never shown
     * again and can never convert.
     */
    it('still gives a member with no history some traffic', async () => {
      const candidates = await buildCandidates([offer('established', '40.00'), offer('fresh', '40.00')], visitor);
      rates.mockResolvedValue(new Map([['established', 0.5]]));
      const rotation = link({ rotation: SmartLinkRotation.BEST_CR });

      let fresh = 0;
      for (let i = 0; i < 400; i += 1) {
        if ((await pickCandidate(rotation, candidates)).offer.id === 'fresh') fresh += 1;
      }
      expect(fresh).toBeGreaterThan(0);
    });

    it('splits evenly when nobody has converted yet', async () => {
      const candidates = await buildCandidates([offer('a', '40.00'), offer('b', '40.00')], visitor);
      rates.mockResolvedValue(new Map());
      const rotation = link({ rotation: SmartLinkRotation.BEST_CR });

      let a = 0;
      for (let i = 0; i < 600; i += 1) {
        if ((await pickCandidate(rotation, candidates)).offer.id === 'a') a += 1;
      }
      expect(a).toBeGreaterThan(200);
      expect(a).toBeLessThan(400);
    });
  });
});
