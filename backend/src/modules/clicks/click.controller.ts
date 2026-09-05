import type { NextFunction, Request, Response } from 'express';
import { clientIp } from '../../common/client-ip';
import { clickService, type ClickTarget } from './click.service';
import { logger } from '../../common/logger';
import type { ClickQueryDto, SmartLinkClickQueryDto } from './click.dto';

// Both entry points hand the service the same visitor, differing only in what they
// point at — so the request is built once here rather than twice.
function visitorFrom(req: Request, query: SmartLinkClickQueryDto, target: ClickTarget) {
  return {
    target,
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
  };
}

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
      const result = await clickService.handleClick(visitorFrom(req, query, { kind: 'offer', offerId: query.offerId }));
      res.redirect(302, result.redirectUrl);
    } catch (err) {
      next(err);
    }
  },

  /**
   * `/sl/:slug` — a smart-link redirect. Identical to a tracking-link click from the
   * visitor's side; the difference is that the offer is chosen at this moment from
   * their geo/device rather than baked into the link.
   */
  async handleSmartLinkClick(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const query = req.query as unknown as SmartLinkClickQueryDto;
      const result = await clickService.handleClick(
        visitorFrom(req, query, { kind: 'smartLink', slug: req.params.slug! }),
      );
      res.redirect(302, result.redirectUrl);
    } catch (err) {
      next(err);
    }
  },
};
