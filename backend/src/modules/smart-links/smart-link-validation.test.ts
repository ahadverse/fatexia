import { describe, expect, it } from 'vitest';
import { createSmartLinkSchema, updateSmartLinkSchema, MISSING_DESTINATION_MESSAGE } from './smart-link.dto';

/**
 * Member offers are optional; a link with nowhere to send traffic is not.
 *
 * `offerIds` used to carry `.min(1)`, which made "a link that is just a redirect"
 * unexpressible. Removing it alone would have allowed a link with no members *and* no
 * destination — which does not degrade gracefully, it throws on every single visitor.
 * So the floor moved from one field to the pair, and these tests pin the pair.
 */
const base = {
  name: 'Rotator',
  slug: 'rotator',
};

const OFFER_ID = '11111111-1111-4111-8111-111111111111';

describe('createSmartLinkSchema', () => {
  it('accepts members with no destination — the chosen offer supplies the address', () => {
    const parsed = createSmartLinkSchema.safeParse({ ...base, offerIds: [OFFER_ID] });
    expect(parsed.success).toBe(true);
  });

  it('accepts a destination with no members — a plain redirect', () => {
    const parsed = createSmartLinkSchema.safeParse({
      ...base,
      offerIds: [],
      destinationUrl: 'https://fatexia.com/go?cid={click_id}',
    });
    expect(parsed.success).toBe(true);
  });

  it('defaults offerIds to an empty list rather than demanding the key', () => {
    const parsed = createSmartLinkSchema.safeParse({ ...base, destinationUrl: 'https://fatexia.com/go' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.offerIds).toEqual([]);
  });

  it('refuses neither — the case that would throw on every visitor', () => {
    const parsed = createSmartLinkSchema.safeParse({ ...base, offerIds: [] });

    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const issue = parsed.error.issues.find((i) => i.path.join('.') === 'destinationUrl');
      expect(issue?.message).toBe(MISSING_DESTINATION_MESSAGE);
    }
  });

  it('allows a revenue share on a link with no members — that is what prices it', () => {
    // This used to be refused, correctly at the time: a memberless link had no offer,
    // /postback resolved one before doing anything, and so the link could not convert.
    // Now such a link logs clicks with a null offerId and its conversions are priced
    // from this percentage against the postback's reported sale, with no payout rule
    // involved. The share is the only rate it has.
    const parsed = createSmartLinkSchema.safeParse({
      ...base,
      offerIds: [],
      destinationUrl: 'https://fatexia.com/go',
      revSharePercent: 80,
    });

    expect(parsed.success).toBe(true);
  });

  it('still allows a revenue share when the link has a member', () => {
    const parsed = createSmartLinkSchema.safeParse({
      ...base,
      offerIds: [OFFER_ID],
      revSharePercent: 80,
    });
    expect(parsed.success).toBe(true);
  });

  it('treats an empty-string destination as absent, not as a value', () => {
    // '' is what an untouched admin form field sends; the schema maps it to null, so it
    // has to fail the pairing exactly as a missing key does.
    const parsed = createSmartLinkSchema.safeParse({ ...base, offerIds: [], destinationUrl: '' });
    expect(parsed.success).toBe(false);
  });
});

describe('updateSmartLinkSchema', () => {
  it('accepts a patch that mentions neither field', () => {
    // The pairing deliberately is not enforced here: an absent `offerIds` means
    // "unchanged", not "empty", so only the service — which has the stored row to merge
    // against — can tell whether the result is a dead link.
    const parsed = updateSmartLinkSchema.safeParse({ name: 'Renamed' });
    expect(parsed.success).toBe(true);
  });

  it('still allows clearing the destination on its own, for the service to judge', () => {
    const parsed = updateSmartLinkSchema.safeParse({ destinationUrl: null });
    expect(parsed.success).toBe(true);
  });
});
