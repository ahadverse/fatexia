import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { messageService } from './message.service';
import type { MessageFiltersDto, ReplyMessageDto, SendMessageDto, ThreadFiltersDto } from './message.dto';

export const messageController = {
  async getMessages(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getMessages(req.query as unknown as MessageFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getThreads(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getThreads(req.query as unknown as ThreadFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getThread(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getThread(req.params.affiliateId!));
    } catch (err) {
      next(err);
    }
  },

  async markThreadRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.markThreadReadByNetwork(req.params.affiliateId!));
    } catch (err) {
      next(err);
    }
  },

  async getUnreadCount(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getUnreadCount());
    } catch (err) {
      next(err);
    }
  },

  async send(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await messageService.send(req.body as SendMessageDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  // Affiliate self-service

  async getOwnThread(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getOwnThread(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async getOwnUnreadCount(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getOwnUnreadCount(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async markOwnThreadRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.markOwnThreadRead(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async reply(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await messageService.reply(req.user!.id, req.body as ReplyMessageDto));
    } catch (err) {
      next(err);
    }
  },
};
