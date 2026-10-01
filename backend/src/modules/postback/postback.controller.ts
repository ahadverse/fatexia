import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../../common/client-ip';
import { ValidationError } from '../../common/errors';
import { logger } from '../../common/logger';
import { zodMessage } from '../../common/validate';
import { PostbackDirection } from '../postback-logs/postback-log.entity';
import { postbackLogRepository } from '../postback-logs/postback-log.repository';
import { postbackService } from './postback.service';
import { postbackQuerySchema } from './postback.dto';

/**
 * Whether a rejected request looks like a real integration rather than a passer-by.
 *
 * /postback is public and unauthenticated, so it is scanned and probed like any other
 * open endpoint, and a rejected request is logged *before* any secret has been checked.
 * Recording every one of them would let anyone fill the table — which on this database
 * is a real limit, not a theoretical one.
 *
 * Carrying any parameter our own postback URLs are built from is the line: an
 * advertiser's misconfigured postback always carries several, and `GET /postback` with
 * nothing on it, or with a scanner's `?id=1`, carries none and is dropped silently.
 */
function looksLikeAnIntegration(query: Record<string, unknown>): boolean {
  return ['secret', 'click_id', 'offerId', 'sum', 'revenue'].some((key) => key in query);
}

/**
 * Query strings reach us bounded by Node's request-line limit, but a rejected payload
 * has by definition not passed the schema's own length caps, so it is trimmed here
 * before being stored. Generous enough that nothing an advertiser actually sends is
 * cut, and small enough that a row cannot be used to park data in the database.
 */
function trimPayload(query: Record<string, unknown>): Record<string, unknown> {
  const trimmed: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query).slice(0, 40)) {
    trimmed[key] = typeof value === 'string' && value.length > 512 ? `${value.slice(0, 512)}…` : value;
  }
  return trimmed;
}

/**
 * Records a postback that never reached the service because its query string did not
 * parse.
 *
 * This is the half the log was missing. `postbackService` logs every attempt it is
 * given, but a schema rejection happens in front of it, so an advertiser sending a
 * malformed value — most often a macro their platform did not substitute, which arrives
 * as the literal `#payout#` or `{sum}` — got a 400 and left no trace anywhere. From the
 * admin's side the postback had simply never arrived, which is the one conclusion that
 * makes the problem impossible to find.
 */
async function logRejected(req: Request, errorMessage: string): Promise<void> {
  const query = req.query as Record<string, unknown>;
  if (!looksLikeAnIntegration(query)) return;
  try {
    await postbackLogRepository.create({
      conversionId: null,
      offerId: null,
      affiliateId: null,
      direction: PostbackDirection.INBOUND,
      payload: trimPayload(query),
      responseStatus: 400,
      success: false,
      errorMessage,
      sourceIp: clientIp(req),
    });
  } catch (err) {
    // Diagnostics must not change the answer: a failed log write would otherwise turn
    // the advertiser's 400 into a 500 and invite their platform to retry a request that
    // can never succeed.
    logger.error({ err }, 'Failed to record a rejected inbound postback');
  }
}

export const postbackController = {
  async handlePostback(req: Request, res: Response, next: NextFunction): Promise<void> {
    // Parsed here rather than by the `validate` middleware so that a rejection can be
    // logged first — see logRejected above.
    const parsed = postbackQuerySchema.safeParse(req.query);
    if (!parsed.success) {
      const message = zodMessage(parsed.error);
      await logRejected(req, message);
      next(new ValidationError(message));
      return;
    }

    try {
      const query = parsed.data;
      await postbackService.handlePostback({
        offerId: query.offerId ?? null,
        clickId: query.click_id,
        secret: query.secret,
        transactionId: query.transaction_id ?? null,
        // Two spellings of one field, collapsed here so nothing downstream has to know
        // there was ever a choice. `sum` wins when an integration sends both, because it
        // is the name our own postback URLs document.
        reportedRevenue: query.sum ?? query.revenue ?? null,
        sourceIp: clientIp(req),
        rawQuery: req.query as Record<string, unknown>,
        timestamp: query.timestamp ?? null,
        ip: query.ip ?? null,
        atlasCode: query.atlas_code ?? null,
        customParameters: query.custom_parameters ?? null,
        conversionId: query.conversion_id ?? null,
        conversionType: query.conversion_type ?? null,
        affiliateUsername: query.affiliate_username ?? null,
        networkName: query.network_name ?? null,
        siteName: query.site_name ?? null,
        programName: query.program_name ?? null,
        campaignName: query.campaign_name ?? null,
        reportedCountryCode: query.country_code ?? null,
        reportedDeviceType: query.device_type ?? null,
        commissionAmount: query.commission_amount ?? null,
        userAgent: query.user_agent ?? null,
        prepaidTransactions: query.prepaid_transactions ?? null,
      });
      // Plain 200 "OK" — advertiser tracking platforms read the status code, not a
      // response body, so there's no reason to hand back JSON here.
      res.status(200).send('OK');
    } catch (err) {
      next(err);
    }
  },
};
