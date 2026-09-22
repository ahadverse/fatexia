import { z } from 'zod';
import { isRefId, isUuid } from '../../common/ref-id';

// GET-only, query-based — mirrors /click. transaction_id stays an opaque advertiser
// reference (their own order/sale id) and is never money.
//
// `sum` is the one money-shaped field accepted, and it is the sale's *revenue* — what
// the advertiser is paying the network — never the affiliate's payout. The rate applied
// to it is still ours: see computeAmounts. An advertiser can say how big the sale was;
// they cannot say what the affiliate keeps.
export const postbackQuerySchema = z.object({
  /**
   * Optional, because a global postback is one URL for the whole catalogue and the
   * caller has no way to fill this in: an upstream tracker's own offer-id macro is
   * *their* id, not ours, so substituting it would name an offer we have never heard
   * of. When absent the offer is taken from the click, which already knows it.
   *
   * Still accepted for the per-offer URLs already handed out — which is why it takes
   * the offer's short `refId` (what the URL carries now) or the uuid (what every URL
   * handed to an advertiser before this carried). A postback URL lives in someone
   * else's system; the network does not get to reissue it.
   */
  offerId: z
    .string()
    .refine((value) => isRefId(value) || isUuid(value), { message: 'Invalid offer' })
    .optional(),
  click_id: z.string().min(1).max(255),
  secret: z.string().min(1),
  transaction_id: z.string().max(255).optional(),
  /**
   * The sale's revenue, as the advertiser reports it. Optional — an offer that pays a
   * flat amount has nothing to report, and every postback URL already handed out omits
   * it, so a missing value must keep meaning "use the rule's configured revenue".
   *
   * Named `sum` because that is what the trackers these URLs are pasted into already
   * call it (Affise and the platforms that copy it); `revenue` is accepted as an alias
   * so nobody has to rewrite a working integration to match our spelling.
   *
   * Coerced, because it arrives as a query string. Rejected rather than clamped when
   * negative: a negative sale is not a refund we know how to price, it is a mistake or
   * a probe, and quietly reading it as zero would price the conversion off the rule as
   * though nothing unusual had been sent.
   */
  //
  // Capped at what `numeric(12,2)` can hold. Without the cap an absurd figure — a typo,
  // a value in the wrong minor unit, or a probe — reaches Postgres as an out-of-range
  // numeric, and the insert throws *after* the conversion has been priced: the caller
  // gets a 500 and the conversion is lost, for a reason nothing in the log explains.
  // Rejected at the edge instead, where it is a clear 400 the advertiser can act on.
  //
  // Presence is NOT enforced here, though the amount is required. That check lives in
  // the service, after authorisation, so a missing value is logged and attributable —
  // see the note there.
  sum: z.coerce.number().finite().nonnegative().max(9_999_999_999.99).optional(),
  revenue: z.coerce.number().finite().nonnegative().max(9_999_999_999.99).optional(),
});

export type PostbackQueryDto = z.infer<typeof postbackQuerySchema>;
