/**
 * The destination URL is stored exactly as the admin typed it.
 *
 * It used to have `click_id={click_id}` and `payout_amount={payout_amount}` appended on
 * every save when they were absent (issue #17), on the theory that an admin who forgot
 * the macros produced traffic nobody could get paid for. The theory was right; the fix
 * was not, because only the *macro* is ours — the parameter **name** belongs to the
 * advertiser, and we have no way to know it.
 *
 * Appending our own spelling produced a URL that looked complete and silently dropped
 * the click id: a tracker that reads `s1` is handed `click_id=258963`, ignores it, and
 * has nothing to report back. Every conversion on such an offer then arrives naming
 * something else — a campaign id, a blank — and is logged as "Offer not found, and no
 * click to resolve one from". A missing macro at least fails visibly at approval time;
 * a macro under the wrong name fails weeks later, in production, as lost revenue.
 *
 * So the admin writes it, under whichever name the advertiser's platform reads:
 *
 *     https://advertiser.example/lp?s1={click_id}
 *
 * The form warns when the macro is absent and approval no longer demands it — see
 * `hasClickIdMacro` and offer.service.ts's activation gate.
 */

/** Trimmed, or null for an offer whose destination has not been filled in yet. */
export function normalizeDestinationUrl(url: string | null | undefined): string | null {
  return url?.trim() || null;
}

/**
 * Whether a destination carries the click-id macro, under any parameter name.
 *
 * Substring rather than a parsed query check on purpose: the macro is legitimately
 * placed in a path segment or a fragment by some platforms, and all that matters is
 * that the redirect has somewhere to substitute the id into.
 */
export function hasClickIdMacro(url: string | null | undefined): boolean {
  return !!url && url.includes('{click_id}');
}
