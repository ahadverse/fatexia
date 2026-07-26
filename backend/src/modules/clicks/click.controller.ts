import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../../common/client-ip';
import { clickService } from './click.service';
import type { ClickQueryDto } from './click.dto';

export const clickController = {
  async handleClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ClickQueryDto;
      const result = await clickService.handleClick({
        offerId: query.offerId,
        affiliateId: query.affiliateId ?? null,
        ip: clientIp(req),
        userAgent: req.headers['user-agent'] ?? null,
        subId1: query.sub1 ?? null,
        subId2: query.sub2 ?? null,
        subId3: query.sub3 ?? null,
        subId4: query.sub4 ?? null,
        subId5: query.sub5 ?? null,
        subId6: query.sub6 ?? null,
        subId7: query.sub7 ?? null,
        subId8: query.sub8 ?? null,
        referer: req.headers.referer ?? null,
      });
      res.redirect(302, result.redirectUrl);
    } catch (err) {
      next(err);
    }
  },
};
