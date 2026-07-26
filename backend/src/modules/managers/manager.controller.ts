import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { managerService } from './manager.service';
import type { CreateManagerDto, ManagerFiltersDto, UpdateManagerDto, UpdateManagerStatusDto } from './manager.dto';

export const managerController = {
  async getManagers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await managerService.getManagers(req.query as unknown as ManagerFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getManager(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await managerService.getManager(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createManager(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await managerService.createManager(req.body as CreateManagerDto));
    } catch (err) {
      next(err);
    }
  },

  async updateManager(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await managerService.updateManager(req.params.id!, req.body as UpdateManagerDto));
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await managerService.updateStatus(req.params.id!, req.body as UpdateManagerStatusDto));
    } catch (err) {
      next(err);
    }
  },
};
