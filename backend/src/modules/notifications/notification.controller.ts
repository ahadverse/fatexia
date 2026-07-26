import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { notificationService } from './notification.service';
import type { CreateNotificationDto, NotificationFiltersDto } from './notification.dto';

export const notificationController = {
  async getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await notificationService.getNotifications(req.user!.id, req.query as unknown as NotificationFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await notificationService.getUnreadCount(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  // Newest few for the header bell — a dedicated route so the dropdown isn't paging
  // the full list endpoint just to read five rows.
  async getRecent(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await notificationService.getRecent(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async create(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await notificationService.create(req.body as CreateNotificationDto));
    } catch (err) {
      next(err);
    }
  },

  async markRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // The caller's own id is passed so the update is scoped to rows they own.
      res.json(await notificationService.markRead(req.params.id!, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async markAllRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await notificationService.markAllRead(req.user!.id));
    } catch (err) {
      next(err);
    }
  },
};
