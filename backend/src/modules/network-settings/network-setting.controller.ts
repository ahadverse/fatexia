import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { networkSettingService } from './network-setting.service';
import type { UpdateNetworkSettingsDto } from './network-setting.dto';

export const networkSettingController = {
  async getSettings(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await networkSettingService.getSettings());
    } catch (err) {
      next(err);
    }
  },

  async updateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await networkSettingService.updateSettings(req.body as UpdateNetworkSettingsDto));
    } catch (err) {
      next(err);
    }
  },
};
