import { describe, expect, it } from 'vitest';
import { hasClickIdMacro, normalizeDestinationUrl } from './destination-url';

/**
 * What matters here is what the admin typed surviving unchanged.
 *
 * These used to assert the opposite — that `click_id={click_id}` was appended to every
 * destination on save. That is what broke the affmine integration: the advertiser's
 * tracker reads `s1`, was handed a parameter called `click_id`, ignored it, and had no
 * id to report back, so every conversion arrived unattributable. The parameter name is
 * the advertiser's to choose, so the URL is now stored verbatim.
 */
describe('normalizeDestinationUrl', () => {
  it('stores a bare landing page exactly as typed', () => {
    expect(normalizeDestinationUrl('https://advertiser.com/lp')).toBe('https://advertiser.com/lp');
  });

  it('leaves the macro under the advertiser’s own parameter name alone', () => {
    const url = 'https://www.af9m8trk.com/P8E11MDD/72911VA2/?s1={click_id}';
    expect(normalizeDestinationUrl(url)).toBe(url);
  });

  it('adds nothing to a URL that already carries both macros', () => {
    const url = 'https://advertiser.com/lp?cid={click_id}&p={payout_amount}';
    expect(normalizeDestinationUrl(url)).toBe(url);
  });

  it('is idempotent across repeated saves', () => {
    const once = normalizeDestinationUrl('https://advertiser.com/lp?s1={click_id}')!;
    expect(normalizeDestinationUrl(once)).toBe(once);
  });

  it('trims surrounding whitespace from a pasted URL', () => {
    expect(normalizeDestinationUrl('  https://advertiser.com/lp  ')).toBe('https://advertiser.com/lp');
  });

  // Null rather than an empty string: an offer with no destination is a draft, and the
  // activation gate reads this column to decide whether it can be approved.
  it.each([[null], [undefined], [''], ['   ']])('returns null for %p', (value) => {
    expect(normalizeDestinationUrl(value)).toBeNull();
  });
});

describe('hasClickIdMacro', () => {
  it.each([
    ['https://advertiser.com/lp?click_id={click_id}', true],
    ['https://advertiser.com/lp?s1={click_id}', true],
    ['https://advertiser.com/lp?aff_sub={click_id}&payout={payout_amount}', true],
    // Placed in a path segment or fragment by some platforms — still substitutable.
    ['https://advertiser.com/lp/{click_id}', true],
    ['https://advertiser.com/lp#cid={click_id}', true],
    ['https://advertiser.com/lp', false],
    ['https://advertiser.com/lp?payout_amount={payout_amount}', false],
    // The advertiser's own macro, not ours — nothing substitutes into it.
    ['https://advertiser.com/lp?s1=#cmpid#', false],
    [null, false],
    ['', false],
  ])('%p → %p', (url, expected) => {
    expect(hasClickIdMacro(url)).toBe(expected);
  });
});
