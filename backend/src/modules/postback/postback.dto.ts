import { z } from 'zod';
import { isRefId, isUuid } from '../../common/ref-id';

/**
 * A macro the advertiser's platform was given but did not recognise, and so passed
 * through verbatim: `#payout#`, `{sum}`, `[revenue]`, `%payout%`.
 *
 * This is what a typo in someone else's postback configuration looks like on the wire,
 * and it is common — every tracking platform spells its tokens differently, and the URL
 * is pasted into a field we never see. It is a *missing* amount, not a malformed one:
 * nothing was substituted, so nothing was sent.
 *
 * Reading it that way matters because of where the two failures land. A value that does
 * not parse is refused by this schema, in front of the service; "no amount sent" is
 * refused inside it, after the click and offer have been resolved, so the log row names
 * the offer and the affiliate and the message says what to change. The second is the
 * one an admin can act on.
 */
function isUnsubstitutedMacro(value: string): boolean {
  return /^(#[^#]*#|\{[^}]*\}|\[[^\]]*\]|%[a-z0-9_]*%)$/i.test(value);
}

/**
 * The sale amount, as it survives contact with an advertiser's tracking platform.
 *
 * Only two things are normalised, both of which mean "no figure was sent": an empty
 * value, and an unsubstituted macro. Number *formats* are deliberately left alone —
 * "1,30" is 1.30 in half of Europe and a malformed 130 elsewhere, and this is the field
 * every payout is calculated from, so guessing wrong here overpays by a factor of a
 * hundred. Anything else that does not parse is still refused, and now logged.
 */
const saleAmount = z.preprocess((raw) => {
  if (typeof raw !== 'string') return raw;
  const trimmed = raw.trim();
  if (trimmed === '' || isUnsubstitutedMacro(trimmed)) return undefined;
  return trimmed;
}, z.coerce.number().finite().nonnegative().max(9_999_999_999.99).optional());

// Kept in sync with the optional fields on postbackQuerySchema below by hand — the
// list every "here's your postback URL" builder (per-offer, global inbound) appends as
// macros so the admin/advertiser can see them, without duplicating validation here.
export const OPTIONAL_POSTBACK_PARAMS = [
  'timestamp',
  'ip',
  'atlas_code',
  'custom_parameters',
  'conversion_id',
  'conversion_type',
  'affiliate_username',
  'network_name',
  'site_name',
  'program_name',
  'campaign_name',
  'country_code',
  'device_type',
  'commission_amount',
  'user_agent',
  'prepaid_transactions',
] as const;

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
  sum: saleAmount,
  revenue: saleAmount,

  // Extra tokens some advertiser tracking platforms carry on their postback (their own
  // macro picker's token names, lowercased). Same treatment as transaction_id above:
  // opaque, stored verbatim, never money — commission_amount included, since the only
  // figure that ever prices a conversion is sum/revenue (see computeAmounts).
  timestamp: z.string().max(255).optional(),
  ip: z.string().max(255).optional(),
  atlas_code: z.string().max(255).optional(),
  custom_parameters: z.string().max(2000).optional(),
  conversion_id: z.string().max(255).optional(),
  conversion_type: z.string().max(255).optional(),
  affiliate_username: z.string().max(255).optional(),
  network_name: z.string().max(255).optional(),
  site_name: z.string().max(255).optional(),
  program_name: z.string().max(255).optional(),
  campaign_name: z.string().max(255).optional(),
  country_code: z.string().max(255).optional(),
  device_type: z.string().max(255).optional(),
  commission_amount: z.string().max(255).optional(),
  user_agent: z.string().max(255).optional(),
  prepaid_transactions: z.string().max(255).optional(),
});

export type PostbackQueryDto = z.infer<typeof postbackQuerySchema>;
