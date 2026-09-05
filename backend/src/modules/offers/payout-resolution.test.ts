import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PayoutMode, PayoutType, RevenueModel, type PayoutRule, type PayoutRuleTargeting } from './payout-rule.entity';
import {
  computeAmounts,
  findMatchingRuleForClick,
  isWildcardTargeting,
  pickRepresentativeRule,
  resolvePayoutRuleForPricing,
  ruleMatchesClick,
} from './payout-resolution';

/**
 * The only part of this module that touches the database is the affiliate-group
 * lookup, and only when a rule actually targets a group. Mocked so the money maths
 * can be tested as the pure functions they are — no Postgres, runnable in CI.
 *
 * `vi.hoisted` because `vi.mock` is lifted above the imports: a plain `const` declared
 * here would still be in its temporal dead zone when the factory runs.
 */
const { findAll } = vi.hoisted(() => ({ findAll: vi.fn() }));
vi.mock('../affiliate-groups/affiliate-group.repository', () => ({
  affiliateGroupRepository: { findAll },
}));

function targeting(overrides: Partial<PayoutRuleTargeting> = {}): PayoutRuleTargeting {
  return { countries: [], devices: [], os: [], affiliateIds: [], affiliateGroupIds: [], ...overrides };
}

function rule(overrides: Partial<PayoutRule> = {}): PayoutRule {
  return {
    id: 'rule-1',
    offerId: 'offer-1',
    payoutMode: PayoutMode.CPA,
    payoutType: PayoutType.FLAT,
    amount: '10.00',
    revenueModel: RevenueModel.NONE,
    revenueAmount: '0.00',
    targeting: targeting(),
    managerCommissionPercent: 0,
    referAffiliateCommissionPercent: 0,
    holdEnabled: false,
    holdDays: 0,
    commissionPercent: 0,
    createdAt: new Date(),
    offer: undefined as never,
    ...overrides,
  };
}

const anyClick = { countryCode: 'US', deviceType: 'desktop', os: 'Windows', affiliateId: 'aff-1' };

beforeEach(() => {
  findAll.mockReset();
  findAll.mockResolvedValue([]);
});

describe('computeAmounts', () => {
  it('pays a flat rule its own amount', () => {
    expect(computeAmounts(rule({ amount: '42.50' }))).toEqual({ revenueAmount: 0, payoutAmount: 42.5 });
  });

  it('pays a percentage rule a share of the rule’s own revenue', () => {
    const percentage = rule({ payoutType: PayoutType.PERCENTAGE, amount: '20', revenueAmount: '150.00' });
    expect(computeAmounts(percentage)).toEqual({ revenueAmount: 150, payoutAmount: 30 });
  });

  it('rounds a percentage payout to whole cents', () => {
    // 33% of 10.10 is 3.333 — a fraction of a cent cannot be paid out, and an
    // unrounded float here would reach the invoice total and never reconcile.
    const percentage = rule({ payoutType: PayoutType.PERCENTAGE, amount: '33', revenueAmount: '10.10' });
    expect(computeAmounts(percentage).payoutAmount).toBe(3.33);
  });

  it('treats a percentage of zero revenue as zero, not NaN', () => {
    const percentage = rule({ payoutType: PayoutType.PERCENTAGE, amount: '20', revenueAmount: '0.00' });
    expect(computeAmounts(percentage).payoutAmount).toBe(0);
  });

  /**
   * The money-integrity rule from PLAN-backend.md, as a test rather than a comment:
   * both figures come from the rule the network configured. There is no parameter
   * here an advertiser's postback could reach, so a payload claiming a huge sale
   * cannot inflate what the network owes.
   */
  it('derives both amounts from the rule alone', () => {
    const configured = rule({ payoutType: PayoutType.PERCENTAGE, amount: '10', revenueAmount: '200.00' });
    expect(computeAmounts(configured)).toEqual({ revenueAmount: 200, payoutAmount: 20 });
    expect(computeAmounts.length).toBe(1);
  });
});

describe('ruleMatchesClick', () => {
  it('matches everything when no dimension is targeted', () => {
    expect(ruleMatchesClick(targeting(), anyClick, [])).toBe(true);
    expect(isWildcardTargeting(targeting())).toBe(true);
  });

  it.each([
    ['country', targeting({ countries: ['US'] }), { ...anyClick, countryCode: 'US' }, true],
    ['country', targeting({ countries: ['BR'] }), { ...anyClick, countryCode: 'US' }, false],
    ['device', targeting({ devices: ['mobile'] }), { ...anyClick, deviceType: 'mobile' }, true],
    ['device', targeting({ devices: ['mobile'] }), { ...anyClick, deviceType: 'desktop' }, false],
    ['os', targeting({ os: ['iOS'] }), { ...anyClick, os: 'iOS' }, true],
    ['os', targeting({ os: ['iOS'] }), { ...anyClick, os: 'Android' }, false],
    ['affiliate', targeting({ affiliateIds: ['aff-1'] }), { ...anyClick, affiliateId: 'aff-1' }, true],
    ['affiliate', targeting({ affiliateIds: ['aff-2'] }), { ...anyClick, affiliateId: 'aff-1' }, false],
  ])('gates on %s', (_dimension, target, click, expected) => {
    expect(ruleMatchesClick(target, click, [])).toBe(expected);
  });

  /**
   * An unknown value must not satisfy a targeted rule. A click whose geo lookup
   * failed is not "in every country" — treating it that way would pay out on traffic
   * the advertiser never agreed to buy.
   */
  it.each([
    ['country', targeting({ countries: ['US'] }), { ...anyClick, countryCode: null }],
    ['device', targeting({ devices: ['mobile'] }), { ...anyClick, deviceType: null }],
    ['os', targeting({ os: ['iOS'] }), { ...anyClick, os: null }],
    ['affiliate', targeting({ affiliateIds: ['aff-1'] }), { ...anyClick, affiliateId: null }],
  ])('refuses to match an unknown %s against a targeted rule', (_dimension, target, click) => {
    expect(ruleMatchesClick(target, click, [])).toBe(false);
  });

  it('requires every targeted dimension, not just one', () => {
    const target = targeting({ countries: ['US'], devices: ['mobile'] });
    expect(ruleMatchesClick(target, { ...anyClick, countryCode: 'US', deviceType: 'mobile' }, [])).toBe(true);
    expect(ruleMatchesClick(target, { ...anyClick, countryCode: 'US', deviceType: 'desktop' }, [])).toBe(false);
  });

  it('matches an affiliate group the click’s affiliate belongs to', () => {
    const target = targeting({ affiliateGroupIds: ['group-a'] });
    expect(ruleMatchesClick(target, anyClick, ['group-a'])).toBe(true);
    expect(ruleMatchesClick(target, anyClick, ['group-b'])).toBe(false);
  });
});

describe('findMatchingRuleForClick (click-time routing)', () => {
  it('returns the first rule whose targeting fits', async () => {
    const brazil = rule({ id: 'br', targeting: targeting({ countries: ['BR'] }) });
    const usa = rule({ id: 'us', targeting: targeting({ countries: ['US'] }) });
    await expect(findMatchingRuleForClick([brazil, usa], anyClick)).resolves.toMatchObject({ id: 'us' });
  });

  /**
   * The null here is what makes issue #15's fallbackUrl reachable: routing must not
   * quietly pick "some rule" for a click that fits none of them, or a visitor lands
   * on an offer the network never agreed to send them.
   */
  it('returns null when every rule is targeted and none fits', async () => {
    const brazil = rule({ targeting: targeting({ countries: ['BR'] }) });
    await expect(findMatchingRuleForClick([brazil], { ...anyClick, countryCode: 'JP' })).resolves.toBeNull();
  });

  it('returns null for an offer with no rules at all', async () => {
    await expect(findMatchingRuleForClick([], anyClick)).resolves.toBeNull();
  });

  it('does not query affiliate groups when no rule targets one', async () => {
    await findMatchingRuleForClick([rule()], anyClick);
    expect(findAll).not.toHaveBeenCalled();
  });

  it('queries affiliate groups only when a rule targets one', async () => {
    findAll.mockResolvedValue([{ id: 'group-a', affiliateIds: ['aff-1'] }]);
    const grouped = rule({ targeting: targeting({ affiliateGroupIds: ['group-a'] }) });
    await expect(findMatchingRuleForClick([grouped], anyClick)).resolves.toMatchObject({ id: 'rule-1' });
    expect(findAll).toHaveBeenCalledOnce();
  });
});

describe('pickRepresentativeRule', () => {
  it('prefers the untargeted rule over the first one', () => {
    const targeted = rule({ id: 'targeted', targeting: targeting({ countries: ['BR'] }) });
    const wildcard = rule({ id: 'wildcard' });
    expect(pickRepresentativeRule([targeted, wildcard])?.id).toBe('wildcard');
  });

  it('falls back to the first rule when every rule is targeted', () => {
    const first = rule({ id: 'first', targeting: targeting({ countries: ['BR'] }) });
    const second = rule({ id: 'second', targeting: targeting({ countries: ['US'] }) });
    expect(pickRepresentativeRule([first, second])?.id).toBe('first');
  });

  it('returns null for an offer with no rules', () => {
    expect(pickRepresentativeRule([])).toBeNull();
  });
});

describe('resolvePayoutRuleForPricing (conversion-time)', () => {
  /**
   * Deliberately more forgiving than routing: a conversion that reaches this point is
   * real money owed to an affiliate, and pricing it from the offer's default rule is
   * better than leaving it unpriced.
   */
  it('prices an orphan postback from the representative rule', async () => {
    const targeted = rule({ id: 'targeted', targeting: targeting({ countries: ['BR'] }) });
    const wildcard = rule({ id: 'wildcard' });
    await expect(resolvePayoutRuleForPricing([targeted, wildcard], null)).resolves.toMatchObject({ id: 'wildcard' });
  });

  it('falls back rather than leaving a matched-nothing conversion unpriced', async () => {
    const brazil = rule({ id: 'br', targeting: targeting({ countries: ['BR'] }) });
    await expect(resolvePayoutRuleForPricing([brazil], { ...anyClick, countryCode: 'JP' })).resolves.toMatchObject({ id: 'br' });
  });

  it('still prefers a genuine match when one exists', async () => {
    const brazil = rule({ id: 'br', targeting: targeting({ countries: ['BR'] }) });
    const usa = rule({ id: 'us', targeting: targeting({ countries: ['US'] }) });
    await expect(resolvePayoutRuleForPricing([brazil, usa], anyClick)).resolves.toMatchObject({ id: 'us' });
  });

  it('returns null only when the offer has no rules', async () => {
    await expect(resolvePayoutRuleForPricing([], anyClick)).resolves.toBeNull();
  });
});
