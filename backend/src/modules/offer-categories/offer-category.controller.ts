import type { NextFunction, Response } from 'express';
import type { AuthenticatedRequest } from '../../common/guards/auth.guard';
import { offerCategoryService } from './offer-category.service';
import type { CreateOfferCategoryDto } from './offer-category.dto';

export const offerCategoryController = {
  async getOfferCategories(_req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      res.json(await offerCategoryService.getOfferCategories());
    } catch (err) {
      next(err);
    }
  },

  async createOfferCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { name } = req.body as CreateOfferCategoryDto;
      res.status(201).json(await offerCategoryService.createOfferCategory(name));
    } catch (err) {
      next(err);
    }
  },

  async deleteOfferCategory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      await offerCategoryService.deleteOfferCategory(req.params.id!);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
};
