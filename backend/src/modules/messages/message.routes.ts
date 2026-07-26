import { Router } from 'express';
import { validate } from '../../common/validate';
import { requireAuth } from '../../common/guards/auth.guard';
import { requireRole } from '../../common/guards/role.guard';
import { UserRole } from '../users/user.entity';
import { messageController } from './message.controller';
import { messageFiltersSchema, replyMessageSchema, sendMessageSchema, threadFiltersSchema } from './message.dto';

export const messageRoutes = Router();

/**
 * Read state is marked per conversation, per side — never per message id.
 *
 * There is deliberately no `PATCH /messages/:id/read`: `readAt` records that the
 * *recipient* read a message, and which party that is depends on the message's
 * direction. A route keyed only on a message id has no way to know which inbox the
 * caller is acting on, so an admin could clear an affiliate's unread state (and vice
 * versa). The two routes below each name their own side explicitly.
 */

// Affiliate self-service. Registered ahead of the admin guard, and `/mine…` sits
// before `/:affiliateId` so it is never swallowed by the parameterised route.
messageRoutes.get('/mine', requireAuth, requireRole(UserRole.AFFILIATE), messageController.getOwnThread);
messageRoutes.get('/mine/unread-count', requireAuth, requireRole(UserRole.AFFILIATE), messageController.getOwnUnreadCount);
messageRoutes.patch('/mine/read', requireAuth, requireRole(UserRole.AFFILIATE), messageController.markOwnThreadRead);
messageRoutes.post(
  '/mine',
  requireAuth,
  requireRole(UserRole.AFFILIATE),
  validate(replyMessageSchema),
  messageController.reply,
);

messageRoutes.use(requireAuth, requireRole(UserRole.ADMIN, UserRole.MANAGER));

messageRoutes.get('/unread-count', messageController.getUnreadCount);
messageRoutes.get('/threads', validate(threadFiltersSchema, 'query'), messageController.getThreads);
messageRoutes.get('/threads/:affiliateId', messageController.getThread);
messageRoutes.patch('/threads/:affiliateId/read', messageController.markThreadRead);
messageRoutes.get('/', validate(messageFiltersSchema, 'query'), messageController.getMessages);
messageRoutes.post('/', validate(sendMessageSchema), messageController.send);
