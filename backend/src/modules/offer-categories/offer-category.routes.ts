import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { offerCategoryController } from './offer-category.controller';
import { createOfferCategorySchema } from './offer-category.dto';

export const offerCategoryRoutes = Router();

offerCategoryRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

offerCategoryRoutes.get('/', offerCategoryController.getOfferCategories);
offerCategoryRoutes.post('/', validate(createOfferCategorySchema), offerCategoryController.createOfferCategory);
offerCategoryRoutes.delete('/:id', offerCategoryController.deleteOfferCategory);
