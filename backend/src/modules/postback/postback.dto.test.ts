import { describe, expect, it } from 'vitest';

/**
 * The query schema is the edge an advertiser's tracking platform actually hits, and it
 * is the only part of the postback path that can refuse a request *before* anything is
 * logged. What it accepts therefore decides what an admin can see went wrong, which is
 * why the sale-amount cases below are tested here rather than left to the service.
 */
import { postbackQuerySchema } from './postback.dto';

const BASE = { click_id: 'CLK-1001', secret: 's3cret' };

function parse(query: Record<string, string>) {
  return postbackQuerySchema.safeParse({ ...BASE, ...query });
}

describe('postbackQuerySchema sale amount', () => {
  it('reads a plain decimal', () => {
    const result = parse({ sum: '1.30' });
    expect(result.success && result.data.sum).toBe(1.3);
  });

  it('accepts `revenue` as an alias', () => {
    const result = parse({ revenue: '2.50' });
    expect(result.success && result.data.revenue).toBe(2.5);
  });

  // The four macro spellings that turn up in practice, one per platform convention.
  // Each is read as "no amount sent" so the request reaches the service and is refused
  // there — with a log row naming the offer — instead of dying here as a bare 400.
  it.each(['#payout#', '{sum}', '[revenue]', '%payout%'])('treats the unsubstituted macro %s as absent', (macro) => {
    const result = parse({ sum: macro });
    expect(result.success).toBe(true);
    expect(result.success && result.data.sum).toBeUndefined();
  });

  it('treats an empty value as absent rather than as zero', () => {
    // Zero would be accepted by the amount check in the service and then quietly priced
    // off the rule, booking a conversion nobody reported a sale for.
    const result = parse({ sum: '' });
    expect(result.success).toBe(true);
    expect(result.success && result.data.sum).toBeUndefined();
  });

  it('still refuses a value that is neither a number nor a macro', () => {
    expect(parse({ sum: 'abc' }).success).toBe(false);
  });

  // Not normalised on purpose: "1,30" is 1.30 under one convention and 130 under
  // another, and this field multiplies out into every payout.
  it('refuses an ambiguous decimal comma instead of guessing', () => {
    expect(parse({ sum: '1,30' }).success).toBe(false);
  });

  it('refuses a negative amount', () => {
    expect(parse({ sum: '-1.00' }).success).toBe(false);
  });

  it('refuses an amount past what the conversion column can hold', () => {
    expect(parse({ sum: '99999999999.00' }).success).toBe(false);
  });

  it('requires a click id', () => {
    expect(postbackQuerySchema.safeParse({ secret: 's3cret', sum: '1.00' }).success).toBe(false);
  });
});
