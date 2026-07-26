import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { affiliateGroupService } from './affiliate-group.service';
import type { CreateAffiliateGroupDto, UpdateAffiliateGroupDto } from './affiliate-group.dto';

export const affiliateGroupController = {
  async getGroups(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateGroupService.getGroups());
    } catch (err) {
      next(err);
    }
  },

  async getGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateGroupService.getGroup(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await affiliateGroupService.createGroup(req.body as CreateAffiliateGroupDto));
    } catch (err) {
      next(err);
    }
  },

  async updateGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateGroupService.updateGroup(req.params.id!, req.body as UpdateAffiliateGroupDto));
    } catch (err) {
      next(err);
    }
  },

  async deleteGroup(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await affiliateGroupService.deleteGroup(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
