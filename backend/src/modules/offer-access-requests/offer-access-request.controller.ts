import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { offerAccessRequestService } from './offer-access-request.service';
import type { AccessRequestFiltersDto, CreateAccessRequestDto, DecideAccessRequestDto } from './offer-access-request.dto';

export const offerAccessRequestController = {
  async getRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await offerAccessRequestService.getRequests(req.query as unknown as AccessRequestFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await offerAccessRequestService.getOwnRequests(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async createRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await offerAccessRequestService.createRequest(req.user!.id, req.body as CreateAccessRequestDto));
    } catch (err) {
      next(err);
    }
  },

  async decide(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await offerAccessRequestService.decide(req.params.id!, req.body as DecideAccessRequestDto, req.user!.id));
    } catch (err) {
      next(err);
    }
  },
};
