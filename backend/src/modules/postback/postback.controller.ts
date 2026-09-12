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
        sourceIp: clientIp(req),
        rawQuery: req.query as Record<string, unknown>,
      });
      // Plain 200 "OK" — advertiser tracking platforms read the status code, not a
      // response body, so there's no reason to hand back JSON here.
      res.status(200).send('OK');
    } catch (err) {
      next(err);
    }
  },
};
