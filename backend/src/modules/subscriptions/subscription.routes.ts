import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { subscriptionController } from './subscription.controller';
import { createSubscriptionSchema, subscriptionFiltersSchema, updateSubscriptionSchema } from './subscription.dto';

export const subscriptionRoutes = Router();

subscriptionRoutes.use(requireAuth, requireRole(UserRole.ADMIN));

subscriptionRoutes.get('/', validate(subscriptionFiltersSchema, 'query'), subscriptionController.getSubscriptions);
subscriptionRoutes.get('/:id', subscriptionController.getSubscription);
subscriptionRoutes.post('/', validate(createSubscriptionSchema), subscriptionController.createSubscription);
subscriptionRoutes.patch('/:id', validate(updateSubscriptionSchema), subscriptionController.updateSubscription);
