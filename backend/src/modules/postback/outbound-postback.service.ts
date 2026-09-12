import { logger } from '../../common/logger';
import { affiliateRepository } from '../affiliates/affiliate.repository';
import { offerRepository } from '../offers/offer.repository';
import { globalPostbackRepository } from '../global-postbacks/global-postback.repository';
import { PostbackDirectionKind } from '../global-postbacks/global-postback.entity';
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

/**
 * Every token a postback URL may contain.
 *
 * The first five are what the affiliate portal's Postback Setup page offers and must
 * stay in step with it — a token that page builds but this does not substitute reaches
 * the affiliate's tracker as the literal "{payout}".
 *
 * The rest exist for network-level outbound postbacks, which feed BI and agency
 * trackers rather than an affiliate's own: those need the whole conversion, not just
 * enough to match a click.
 */
const MACROS = [
  'click_id',
  'payout',
  'currency',
  'status',
  'offer_id',
  'conversion_id',
  'offer_name',
  'affiliate_id',
  'transaction_id',
  'country',
  'revenue',
  'is_duplicate',
  'timestamp',
  'sub1',
  'sub2',
  'sub3',
  'sub4',
  'sub5',
  'sub6',
  'sub7',
  'sub8',
] as const;

// An affiliate's endpoint being slow must not hold a request open indefinitely. Ten
// seconds is generous for what should be a redirect-speed callback.
const TIMEOUT_MS = 10_000;

// Spaced rather than immediate: a retry fired instantly after a failure usually hits
// the same half-second of downtime that caused it.
const RETRY_DELAYS_MS = [2_000, 10_000];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildValues(conversion: Conversion, offerName: string): Record<string, string> {
  return {
    click_id: conversion.clickId ?? '',
    payout: Number(conversion.payoutAmount).toFixed(2),
    currency: conversion.currency,
    status: conversion.status,
    offer_id: conversion.offerId,
    conversion_id: conversion.id,
    offer_name: offerName,
    affiliate_id: conversion.affiliateId ?? '',
    transaction_id: conversion.transactionId ?? '',
    country: conversion.countryCode ?? '',
    // Revenue is the advertiser's side of the margin. It reaches network-level
    // endpoints only — an affiliate's postback URL can carry the token, but the
    // affiliate never sees the value anywhere else, so it is not offered on their
    // setup page (money-visibility rule, PLAN.md).
    revenue: Number(conversion.revenueAmount).toFixed(2),
    is_duplicate: conversion.isDuplicate ? '1' : '0',
    timestamp: new Date().toISOString(),
    sub1: conversion.subId1 ?? '',
    sub2: conversion.subId2 ?? '',
    sub3: conversion.subId3 ?? '',
    sub4: conversion.subId4 ?? '',
    sub5: conversion.subId5 ?? '',
    sub6: conversion.subId6 ?? '',
    sub7: conversion.subId7 ?? '',
    sub8: conversion.subId8 ?? '',
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
  const offer = await offerRepository.findById(conversion.offerId);
  const values = buildValues(conversion, offer?.name ?? '');

  const targets: { template: string; globalId: string | null }[] = [];

  if (conversion.affiliateId) {
    const affiliate = await affiliateRepository.findById(conversion.affiliateId);
    const template = affiliate?.postbackUrl?.trim();
    // Most affiliates never set one. That is not a failure and should not generate a
    // log row, or the Postback Logs page fills with non-events.
    if (template) targets.push({ template, globalId: null });
  }

  // Network-level endpoints fire for every conversion, including orphans with no
  // affiliate — a BI warehouse wants those rows too.
  for (const entry of await globalPostbackRepository.findEnabled(PostbackDirectionKind.OUTBOUND)) {
    if (entry.url?.trim()) targets.push({ template: entry.url.trim(), globalId: entry.id });
  }

  // One failing endpoint must not stop the others, so each is delivered independently.
  await Promise.all(targets.map((target) => deliver(conversion, target, values)));
}

async function deliver(
  conversion: Conversion,
  target: { template: string; globalId: string | null },
  values: Record<string, string>,
): Promise<void> {
  const url = substitutePostbackMacros(target.template, values);

  let status: number | null = null;
  let error: string | null = null;
  let attempts = 0;

  for (let i = 0; i <= RETRY_DELAYS_MS.length; i += 1) {
    if (i > 0) await sleep(RETRY_DELAYS_MS[i - 1] ?? 0);
    attempts += 1;
    ({ status, error } = await attempt(url));
    if (!error) break;
  }

  if (!error && target.globalId) {
    await globalPostbackRepository.markUsed(target.globalId).catch(() => undefined);
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
