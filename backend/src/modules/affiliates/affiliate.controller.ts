import type { NextFunction, Response } from 'express';
import type { ScopedRequest } from '../../common/guards/manager-scope.guard';
import { affiliateService, type AffiliateScope } from './affiliate.service';
import type {
  AffiliateFiltersDto,
  CreateAffiliateDto,
  UpdateAffiliateDto,
  UpdateAffiliateStatusDto,
  UpdateOwnProfileDto,
} from './affiliate.dto';

/**
 * Issue #5 — the single place a request turns into "which affiliates may this person
 * touch". `attachManagerScope` sets `managerScope` for MANAGER logins only, so an
 * absent scope means admin, and admin means the whole network.
 */
function scopeOf(req: ScopedRequest): AffiliateScope {
  return req.managerScope?.managerId ?? null;
}

export const affiliateController = {
  async getAffiliates(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getAffiliates(req.query as unknown as AffiliateFiltersDto, scopeOf(req)));
    } catch (err) {
      next(err);
    }
  },

  async getOwnProfile(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getOwnProfile(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async updateOwnProfile(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.updateOwnProfile(req.user!.id, req.body as UpdateOwnProfileDto));
    } catch (err) {
      next(err);
    }
  },

  async getOwnReferrals(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getOwnReferrals(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  // Issue #6 — the manager contact card the affiliate portal renders under its nav.
  async getOwnManager(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getOwnManagerContact(req.user!.id));
    } catch (err) {
      next(err);
    }
  },

  async getAffiliate(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.getAffiliate(req.params.id!, scopeOf(req)));
    } catch (err) {
      next(err);
    }
  },

  async createAffiliate(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.status(201).json(await affiliateService.createAffiliate(req.body as CreateAffiliateDto, scopeOf(req)));
    } catch (err) {
      next(err);
    }
  },

  async updateAffiliate(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.updateAffiliate(req.params.id!, req.body as UpdateAffiliateDto, scopeOf(req)));
    } catch (err) {
      next(err);
    }
  },

  async updateStatus(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.updateStatus(req.params.id!, req.body as UpdateAffiliateStatusDto, scopeOf(req)));
    } catch (err) {
      next(err);
    }
  },

  async markEmailVerified(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await affiliateService.markEmailVerified(req.params.id!, scopeOf(req)));
    } catch (err) {
      next(err);
    }
  },

  async impersonate(req: ScopedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const tokens = await affiliateService.impersonate(
        req.params.id!,
        { id: req.user!.id },
        { ip: req.ip ?? 'unknown', userAgent: req.headers['user-agent'] ?? null },
        scopeOf(req),
      );
      res.json(tokens);
    } catch (err) {
      next(err);
    }
  },
};
