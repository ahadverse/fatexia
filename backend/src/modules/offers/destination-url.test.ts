import { describe, expect, it } from 'vitest';
import { withTrackingMacros } from './destination-url';

/**
 * Issue #17 — the admin types a landing page and the macros get added for them.
 *
 * The idempotency cases matter most: this runs on every save, so an offer edited
 * three times must not accumulate three copies of `click_id=`.
 */
describe('withTrackingMacros', () => {
  it('appends both macros to a bare URL', () => {
    expect(withTrackingMacros('https://advertiser.com/lp')).toBe(
      'https://advertiser.com/lp?click_id={click_id}&payout_amount={payout_amount}',
    );
  });

  it('joins onto an existing query string with &', () => {
    expect(withTrackingMacros('https://advertiser.com/lp?utm_source=fatexia')).toBe(
      'https://advertiser.com/lp?utm_source=fatexia&click_id={click_id}&payout_amount={payout_amount}',
    );
  });

  it('leaves a URL that already has both macros untouched', () => {
    const already = 'https://advertiser.com/lp?cid={click_id}&p={payout_amount}';
    expect(withTrackingMacros(already)).toBe(already);
  });

  it('is idempotent across repeated saves', () => {
    const once = withTrackingMacros('https://advertiser.com/lp')!;
    const twice = withTrackingMacros(once)!;
    expect(twice).toBe(once);
    expect(twice.match(/click_id=/g)).toHaveLength(1);
  });

  it('adds only the macro that is missing', () => {
    // The admin wired click_id under the advertiser's own parameter name; that must
    // survive, and only payout_amount gets added.
    expect(withTrackingMacros('https://advertiser.com/lp?transaction_id={click_id}')).toBe(
      'https://advertiser.com/lp?transaction_id={click_id}&payout_amount={payout_amount}',
    );
  });

  /**
   * A fragment is never sent to the server, so parameters appended after a `#` reach
   * nobody — the advertiser would see no click_id and the conversion would be
   * unattributable.
   */
  it('keeps the fragment at the end', () => {
    expect(withTrackingMacros('https://advertiser.com/lp#section')).toBe(
      'https://advertiser.com/lp?click_id={click_id}&payout_amount={payout_amount}#section',
    );
  });

  it('handles a fragment alongside an existing query string', () => {
    expect(withTrackingMacros('https://advertiser.com/lp?a=1#top')).toBe(
      'https://advertiser.com/lp?a=1&click_id={click_id}&payout_amount={payout_amount}#top',
    );
  });

  it('does not leave an empty parameter after a trailing ? or &', () => {
    expect(withTrackingMacros('https://advertiser.com/lp?')).toBe(
      'https://advertiser.com/lp?click_id={click_id}&payout_amount={payout_amount}',
    );
    expect(withTrackingMacros('https://advertiser.com/lp?a=1&')).toBe(
      'https://advertiser.com/lp?a=1&click_id={click_id}&payout_amount={payout_amount}',
    );
  });

  it('trims surrounding whitespace from a pasted URL', () => {
    expect(withTrackingMacros('  https://advertiser.com/lp  ')).toBe(
      'https://advertiser.com/lp?click_id={click_id}&payout_amount={payout_amount}',
    );
  });

  // Null rather than a macro-only string: an offer with no destination is a draft, and
  // "?click_id={click_id}" is not a URL anyone can be redirected to.
  it.each([[null], [undefined], [''], ['   ']])('returns null for %p', (value) => {
    expect(withTrackingMacros(value)).toBeNull();
  });
});
