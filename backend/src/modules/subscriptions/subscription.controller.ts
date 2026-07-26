import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { subscriptionService } from './subscription.service';
import type { CreateSubscriptionDto, SubscriptionFiltersDto, UpdateSubscriptionDto } from './subscription.dto';

export const subscriptionController = {
  async getSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await subscriptionService.getSubscriptions(req.query as unknown as SubscriptionFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await subscriptionService.getSubscription(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await subscriptionService.createSubscription(req.body as CreateSubscriptionDto));
    } catch (err) {
      next(err);
    }
  },

  async updateSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await subscriptionService.updateSubscription(req.params.id!, req.body as UpdateSubscriptionDto));
    } catch (err) {
      next(err);
    }
  },
};
