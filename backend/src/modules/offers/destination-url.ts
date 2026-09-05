/**
 * Issue #17 — the destination URL always carries the tracking macros, whether or not
 * whoever filled the form remembered to type them.
 *
 * `{click_id}` is not optional: /click mints an id per click and the postback matches
 * a conversion back to it, so a destination without the macro produces traffic nobody
 * can ever get paid for. It used to be the admin's job to remember, enforced by
 * refusing to approve the offer — a late, confusing failure for something the server
 * can simply do itself.
 *
 * `{payout_amount}` is appended on the same principle. Worth knowing what that means:
 * it puts the affiliate payout for the matched rule on the advertiser's landing page
 * URL, so an advertiser who reads their own query string learns the network's cost
 * per conversion, and the margin between it and their payout. That is the behaviour
 * asked for; an offer that shouldn't expose it can have the macro removed from its
 * destination URL by hand, and this only ever adds the macros when they are absent.
 *
 * Both are substituted at redirect time from the offer's own payout rule — never from
 * anything an inbound call reports (see click.service.ts).
 */
const REQUIRED_MACROS: { macro: string; param: string }[] = [
  { macro: '{click_id}', param: 'click_id' },
  { macro: '{payout_amount}', param: 'payout_amount' },
];

export function withTrackingMacros(url: string | null | undefined): string | null {
  const trimmed = url?.trim();
  if (!trimmed) return null;

  // Split the fragment off first: appending after a `#` would put the parameters
  // inside the fragment, where no server ever sees them.
  const hashAt = trimmed.indexOf('#');
  const base = hashAt === -1 ? trimmed : trimmed.slice(0, hashAt);
  const fragment = hashAt === -1 ? '' : trimmed.slice(hashAt);

  const missing = REQUIRED_MACROS.filter((entry) => !trimmed.includes(entry.macro));
  if (missing.length === 0) return trimmed;

  const query = missing.map((entry) => `${entry.param}=${entry.macro}`).join('&');
  // A base already ending in `?`/`&` would otherwise gain an empty parameter.
  const separator = /[?&]$/.test(base) ? '' : base.includes('?') ? '&' : '?';
  return `${base}${separator}${query}${fragment}`;
}
