import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../../common/client-ip';
import { clickService } from './click.service';
import { logger } from '../../common/logger';
import type { ClickQueryDto } from './click.dto';

export const clickController = {
  async handleClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as ClickQueryDto;
      // Temporary — remove once TRUST_PROXY's hop count is confirmed correct against
      // Render's actual proxy chain. req.ip has been resolving to an internal
      // 10.x.x.x address instead of the real visitor; this shows the raw header Render
      // sends so the hop count can be set correctly instead of guessed.
      logger.info(
        { xForwardedFor: req.headers['x-forwarded-for'], resolvedIp: clientIp(req), trustProxySetting: req.app.get('trust proxy') },
        'Click IP resolution debug',
      );
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
