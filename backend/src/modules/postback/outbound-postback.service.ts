import { logger } from '../../common/logger';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { postbackLogRepository } from '../postback-logs/postback-log.repository';
import { PostbackDirection } from '../postback-logs/postback-log.entity';
import type { Conversion } from '../conversions/conversion.entity';

/**
 * Fires the affiliate's own postback URL so their tracker learns about a conversion.
 *
 * The other half of the inbound `/postback` route: an advertiser tells us a conversion
 * happened, and this tells the affiliate. Until now only the inbound half existed, so
 * the URL an affiliate saved on Postback Setup was stored and never called — the page
 * promised "we ping this URL when one of your conversions is approved" and nothing did.
 */

// Must stay in step with the MACROS list on the affiliate portal's Postback Setup page:
// that page builds the URL from these tokens, so a token it offers and this does not
// substitute would be delivered to the affiliate's tracker as the literal "{payout}".
const MACROS = ['click_id', 'payout', 'currency', 'status', 'offer_id'] as const;

// An affiliate's endpoint being slow must not hold a request open indefinitely. Ten
// seconds is generous for what should be a redirect-speed callback.
const TIMEOUT_MS = 10_000;

// Spaced rather than immediate: a retry fired instantly after a failure usually hits
// the same half-second of downtime that caused it.
const RETRY_DELAYS_MS = [2_000, 10_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildValues(conversion: Conversion): Record<string, string> {
  return {
    click_id: conversion.clickId ?? '',
    payout: Number(conversion.payoutAmount).toFixed(2),
    currency: conversion.currency,
    status: conversion.status,
    offer_id: conversion.offerId,
  };
}

/**
 * Replaces `{token}` placeholders in the saved URL.
 *
 * Values are URL-encoded, because they land in a query string the affiliate composed —
 * an un-encoded value containing `&` would silently add a parameter to their callback.
 * Unknown tokens are left alone rather than blanked: an affiliate using a macro from
 * their previous network should see it come back unrecognised, not disappear.
 */
export function substitutePostbackMacros(url: string, values: Record<string, string>): string {
  let result = url;
  for (const macro of MACROS) {
    result = result.split(`{${macro}}`).join(encodeURIComponent(values[macro] ?? ''));
  }
  return result;
}

async function attempt(url: string): Promise<{ status: number | null; error: string | null }> {
  try {
    const res = await fetch(url, { method: 'GET', signal: AbortSignal.timeout(TIMEOUT_MS) });
    // Any 2xx counts. Affiliate trackers answer with 200 and a pixel, 204, or a
    // redirect — the body is never meaningful, only that it was accepted.
    return { status: res.status, error: res.ok ? null : `HTTP ${res.status}` };
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : 'Request failed' };
  }
}

/**
 * Delivers one conversion to one affiliate, retrying a failure a couple of times, then
 * records the outcome on `postback_logs` for the admin's Postback Logs page.
 *
 * Never throws. The caller is an approval that has already been committed; an
 * affiliate's unreachable server is not a reason to fail the admin's action or to roll
 * back a conversion they just approved.
 */
export async function sendConversionPostback(conversion: Conversion): Promise<void> {
  if (!conversion.affiliateId) return;

  const affiliate = await affiliateRepository.findById(conversion.affiliateId);
  const template = affiliate?.postbackUrl?.trim();
  // Most affiliates never set one. That is not a failure and should not generate a log
  // row, or the Postback Logs page fills with non-events.
  if (!template) return;

  const values = buildValues(conversion);
  const url = substitutePostbackMacros(template, values);

  let status: number | null = null;
  let error: string | null = null;
  let attempts = 0;

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i += 1) {
    if (i > 0) await sleep(RETRY_DELAYS_MS[i - 1] ?? 0);
    attempts += 1;
    ({ status, error } = await attempt(url));
    if (!error) break;
  }

  try {
    await postbackLogRepository.create({
      conversionId: conversion.id,
      offerId: conversion.offerId,
      affiliateId: conversion.affiliateId,
      direction: PostbackDirection.OUTBOUND,
      url,
      // The substituted values, not the raw template — what was actually sent is what
      // an admin debugging a complaint needs to see.
      payload: values,
      responseStatus: status,
      success: !error,
      errorMessage: error,
      attemptCount: attempts,
      sourceIp: null,
    });
  } catch (err) {
    logger.error({ err, conversionId: conversion.id }, 'Failed to record outbound postback log');
  }
}

/**
 * Fire-and-forget wrapper — same pattern as `safeSendEmail` and `safeNotify`.
 *
 * Deliberately not awaited by callers: with two retries this can take over ten seconds,
 * and no admin should watch a spinner for that long because an affiliate's endpoint is
 * down.
 */
export function safeSendConversionPostback(conversion: Conversion): void {
  void sendConversionPostback(conversion).catch((err) =>
    logger.error({ err, conversionId: conversion.id }, 'Outbound postback failed'),
  );
}
