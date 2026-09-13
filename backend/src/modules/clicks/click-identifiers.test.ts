import { describe, expect, it } from 'vitest';
import { affiliateLinkId, affiliateTrackingLinkFor } from '../offers/offer.dto';
import { clickQuerySchema } from './click.dto';

/**
 * The two ends of a tracking link have to agree.
 *
 * One side builds links (`affiliateTrackingLinkFor`); the other decides which
 * identifiers the tracker will accept (`clickQuerySchema`). They live in different
 * modules and nothing forces them to match, and when they drifted the failure was
 * silent in the worst way: links carrying `AFF-1001` were validated against a rule that
 * allowed only digits and uuids, so the affiliate id was dropped, every click was
 * recorded unattributed, the affiliate earned nothing, and no error appeared anywhere.
 *
 * These tests take the link the product actually generates and push it through the
 * parser the tracker actually uses, so the two cannot drift apart again unnoticed.
 */

function paramsOf(link: string): Record<string, string> {
  return Object.fromEntries(new URL(link).searchParams.entries());
}

describe('tracking link identifiers', () => {
  it('accepts the link the product generates', () => {
    const link = affiliateTrackingLinkFor(100042, 'AFF-1001');
    const parsed = clickQuerySchema.safeParse(paramsOf(link));

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.offerId).toBe('100042');
    // The affiliate id must survive parsing — dropped, the click is unattributed and
    // the affiliate is not paid for traffic they sent.
    expect(parsed.success && parsed.data.affiliateId).toBe('AFF-1001');
  });

  it('still accepts links issued before the short ids existed', () => {
    // A link, once pasted into an ad platform, is not something the network can reissue.
    const legacy = {
      offerId: 'cc92887b-faea-5500-90e2-f7a001467e3f',
      affiliateId: '27ae2493-3bff-5135-9a3e-733db03c3eb5',
    };
    const parsed = clickQuerySchema.safeParse(legacy);

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.affiliateId).toBe(legacy.affiliateId);
  });

  it('derives the link id from the affiliate the same way the DTO does', () => {
    expect(affiliateLinkId({ publicId: 'AFF-1042', id: 'uuid-here' })).toBe('AFF-1042');
    // Falls back to the uuid for a row with no display id, so the link still works.
    expect(affiliateLinkId({ publicId: null, id: 'uuid-here' })).toBe('uuid-here');
  });

  it('drops an unusable affiliate id instead of rejecting the click', () => {
    // click.entity.ts: a click with a bad or missing affiliate is still logged — the
    // visitor must reach the advertiser, and an unattributable click is itself a signal.
    const parsed = clickQuerySchema.safeParse({ offerId: '100042', affiliateId: 'not-an-id' });

    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.affiliateId).toBeUndefined();
  });

  it('rejects a click whose offer cannot be identified', () => {
    // Unlike the affiliate, there is nothing to salvage: no offer means no destination.
    expect(clickQuerySchema.safeParse({ offerId: 'nonsense' }).success).toBe(false);
  });

  it('carries sub-ids through untouched', () => {
    const parsed = clickQuerySchema.safeParse({ offerId: '100042', affiliateId: 'AFF-1001', sub1: 'fb-campaign-7' });
    expect(parsed.success && parsed.data.sub1).toBe('fb-campaign-7');
  });
});
