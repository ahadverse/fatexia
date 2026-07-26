import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { offerService } from './offer.service';
import type { CreateOfferDto, OfferFiltersDto, UpdateOfferDto, UpdateOfferStatusDto } from './offer.dto';

export const offerController = {
  async getOffers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const filters = req.query as unknown as OfferFiltersDto;
      res.json(await offerService.getOffers(filters));
    } catch (err) {
      next(err);
    }
  },

  async getAvailableOffers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await offerService.getAvailableOffers(req.user!));
    } catch (err) {
      next(err);
    }
  },

  async getOffer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await offerService.getOffer(req.params.id!));
    } catch (err) {
      next(err);
    }
  },

  async createOffer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const offer = await offerService.createOffer(req.body as CreateOfferDto);
      res.status(201).json(offer);
    } catch (err) {
      next(err);
    }
  },

  async updateOffer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const offer = await offerService.updateOffer(req.params.id!, req.body as UpdateOfferDto);
      res.json(offer);
    } catch (err) {
      next(err);
    }
  },

  async updateOfferStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const offer = await offerService.updateOfferStatus(req.params.id!, req.body as UpdateOfferStatusDto);
      res.json(offer);
    } catch (err) {
      next(err);
    }
  },
};
