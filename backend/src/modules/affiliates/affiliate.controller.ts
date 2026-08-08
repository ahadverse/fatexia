import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { affiliateService } from './affiliate.service';
import type {
  AffiliateFiltersDto,
  CreateAffiliateDto,
  UpdateAffiliateDto,
  UpdateAffiliateStatusDto,
  UpdateOwnProfileDto,
} from './affiliate.dto';

export const affiliateController = {
  async getAffiliates(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getAffiliates(req.query as unknown as AffiliateFiltersDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getOwnProfile(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async updateOwnProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.updateOwnProfile(req.user!.id, req.body as UpdateOwnProfileDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnReferrals(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getOwnReferrals(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async getAffiliate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getAffiliate(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createAffiliate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await affiliateService.createAffiliate(req.body as CreateAffiliateDto));
    } catch (err) {
      next(err);
    }
  },

  async updateAffiliate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.updateAffiliate(req.params.id!, req.body as UpdateAffiliateDto));
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.updateStatus(req.params.id!, req.body as UpdateAffiliateStatusDto));
    } catch (err) {
      next(err);
    }
  },

  async markEmailVerified(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.markEmailVerified(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async impersonate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokens = await affiliateService.impersonate(req.params.id!, { id: req.user!.id }, {
        ip: req.ip ?? 'unknown',
        userAgent: req.headers['user-agent'] ?? null,
      });
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },
};
