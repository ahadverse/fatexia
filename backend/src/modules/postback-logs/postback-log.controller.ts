import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { postbackLogService } from './postback-log.service';
import type { PostbackLogFiltersDto } from './postback-log.dto';

export const postbackLogController = {
  async getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await postbackLogService.getLogs(req.query as unknown as PostbackLogFiltersDto));
    } catch (err) {
      next(err);
    }
  },
};
