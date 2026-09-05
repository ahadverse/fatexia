import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import type { ScopedRequest } from '../../common/guards/manager-scope.guard';
import { scopedQuery } from '../../common/manager-scope-sql';
import { affiliateService } from '../affiliates/affiliate.service';
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

  // A manager's inbox holds only their own affiliates' threads (issue #5); an admin
  // sees every conversation on the network.
  async getThreads(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getThreads(scopedQuery<ThreadFiltersDto>(req.query, req.managerScope?.managerId)));
    } catch (err) {
      next(err);
    }
  },

  async getThread(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Reuses the affiliate scope check, so opening someone else's conversation by
      // pasting their id reads as "not found" rather than handing over the transcript.
      await affiliateService.loadInScope(req.params.affiliateId!, req.managerScope?.managerId ?? null);
      res.json(await messageService.getThread(req.params.affiliateId!));
    } catch (err) {
      next(err);
    }
  },

  async markThreadRead(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await affiliateService.loadInScope(req.params.affiliateId!, req.managerScope?.managerId ?? null);
      res.json(await messageService.markThreadReadByNetwork(req.params.affiliateId!));
    } catch (err) {
      next(err);
    }
  },

  async getUnreadCount(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await messageService.getUnreadCount(req.managerScope?.managerId));
    } catch (err) {
      next(err);
    }
  },

  async send(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const dto = req.body as SendMessageDto;
      await affiliateService.loadInScope(dto.affiliateId, req.managerScope?.managerId ?? null);
      res.status(201).json(await messageService.send(dto, req.user!.id));
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
