import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { notificationController } from './notification.controller';
import { createNotificationSchema, notificationFiltersSchema } from './notification.dto';

export const notificationRoutes = Router();

// Any signed-in user reads their own feed; only admins author notifications.
notificationRoutes.use(requireAuth);

notificationRoutes.get('/unread-count', notificationController.getUnreadCount);
notificationRoutes.get('/recent', notificationController.getRecent);
notificationRoutes.get('/', validate(notificationFiltersSchema, 'query'), notificationController.getNotifications);
notificationRoutes.patch('/read-all', notificationController.markAllRead);
notificationRoutes.patch('/:id/read', notificationController.markRead);
notificationRoutes.post('/', requireRole(UserRole.ADMIN), validate(createNotificationSchema), notificationController.create);
