import { describe, expect, it } from 'vitest';
import { substitutePostbackMacros } from './outbound-postback.service';

const VALUES = {
  click_id: 'abc-123',
  payout: '12.50',
  currency: 'USD',
  status: 'APPROVED',
  offer_id: 'offer-9',
};

describe('substitutePostbackMacros', () => {
  it('replaces every macro the affiliate portal offers', () => {
    const url = substitutePostbackMacros(
      'https://t.example.com/cb?c={click_id}&p={payout}&cur={currency}&s={status}&o={offer_id}',
      VALUES,
    );
    expect(url).toBe('https://t.example.com/cb?c=abc-123&p=12.50&cur=USD&s=APPROVED&o=offer-9');
  });

  it('replaces a macro used more than once', () => {
    expect(substitutePostbackMacros('https://x.test/?a={click_id}&b={click_id}', VALUES)).toBe(
      'https://x.test/?a=abc-123&b=abc-123',
    );
  });

  // The affiliate composed the query string; an un-encoded value carrying & or = would
  // add parameters to their callback that they never wrote.
  it('encodes values so they cannot inject query parameters', () => {
    const url = substitutePostbackMacros('https://x.test/?c={click_id}', {
      ...VALUES,
      click_id: 'a&admin=1 b',
    });
    expect(url).toBe('https://x.test/?c=a%26admin%3D1%20b');
  });

  // An orphan conversion has no click, and a tracker receiving `click_id=` at least
  // sees an empty value rather than the literal "{click_id}".
  it('substitutes an empty string for a missing value', () => {
    expect(substitutePostbackMacros('https://x.test/?c={click_id}', { ...VALUES, click_id: '' })).toBe(
      'https://x.test/?c=',
    );
  });

  // Someone migrating from another network keeps their old tokens in the saved URL;
  // blanking them would hide the mistake instead of showing it.
  it('leaves unknown macros untouched', () => {
    expect(substitutePostbackMacros('https://x.test/?c={click_id}&z={aff_sub}', VALUES)).toBe(
      'https://x.test/?c=abc-123&z={aff_sub}',
    );
  });

  it('returns a URL with no macros unchanged', () => {
    expect(substitutePostbackMacros('https://x.test/fixed', VALUES)).toBe('https://x.test/fixed');
  });
});
