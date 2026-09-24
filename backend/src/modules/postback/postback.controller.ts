import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../../common/client-ip';
import { postbackService } from './postback.service';
import type { PostbackQueryDto } from './postback.dto';

export const postbackController = {
  async handlePostback(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as PostbackQueryDto;
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
