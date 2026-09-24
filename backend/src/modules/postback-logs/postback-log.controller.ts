import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { postbackLogService } from './postback-log.service';
import type { BulkDeletePostbackLogsDto, PostbackLogFiltersDto } from './postback-log.dto';

export const postbackLogController = {
  async getLogs(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await postbackLogService.getLogs(req.query as unknown as PostbackLogFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async bulkDelete(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { ids } = req.body as BulkDeletePostbackLogsDto;
      res.json(await postbackLogService.bulkDelete(ids));
    } catch (err) {
      next(err);
    }
  },
};
