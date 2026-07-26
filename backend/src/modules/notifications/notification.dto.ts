import { z } from 'zod';
import { paginationSchema } from '../../common/pagination';
import { NotificationCategory, NotificationLevel, type Notification } from './notification.entity';

export const notificationFiltersSchema = paginationSchema.extend({
  category: z.nativeEnum(NotificationCategory).optional(),
  level: z.nativeEnum(NotificationLevel).optional(),
  unreadOnly: z.coerce.boolean().optional(),
});

export type NotificationFiltersDto = z.infer<typeof notificationFiltersSchema>;

/**
 * `userId` is required.
 *
 * A null userId used to mean "broadcast", which made audience a property of the query
 * instead of the row — an affiliate then saw the network's internal notices, and one
 * admin reading a broadcast marked it read for every admin. Notifications are fanned
 * out at write time instead; `notifyNetwork` in the service is how you reach staff.
 */
export const createNotificationSchema = z.object({
  userId: z.string().uuid(),
  level: z.nativeEnum(NotificationLevel).default(NotificationLevel.INFO),
  category: z.nativeEnum(NotificationCategory).default(NotificationCategory.SYSTEM),
  title: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1).max(2000),
  link: z.string().trim().max(255).optional(),
});

export type CreateNotificationDto = z.infer<typeof createNotificationSchema>;

/** What a domain event supplies; the recipient is decided by the notify helper. */
export interface NotificationContent {
  level?: NotificationLevel;
  category?: NotificationCategory;
  title: string;
  body: string;
  link?: string | null;
}

export interface NotificationDto {
  id: string;
  userId: string;
  level: NotificationLevel;
  category: NotificationCategory;
  title: string;
  body: string;
  link: string | null;
  readAt: string | null;
  createdAt: string;
}

export function toNotificationDto(notification: Notification): NotificationDto {
  return {
    id: notification.id,
    userId: notification.userId,
    level: notification.level,
    category: notification.category,
    title: notification.title,
    body: notification.body,
    link: notification.link,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}
