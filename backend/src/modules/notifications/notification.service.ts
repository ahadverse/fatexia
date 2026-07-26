import { In } from 'typeorm';
import { NotFoundError } from '../../common/errors';
import { logger } from '../../common/logger';
import { paginate, type Paginated } from '../../common/pagination';
import { AppDataSource } from '../../infra/database/data-source';
import { emitToRoom } from '../../infra/realtime/socket-server';
import { REALTIME_EVENTS, ROOMS } from '../../infra/realtime/events';
import { User, UserRole, UserStatus } from '../users/user.entity';
import { Affiliate } from '../affiliates/affiliate.entity';
import { notificationRepository } from './notification.repository';
import { NotificationCategory, NotificationLevel } from './notification.entity';
import {
  toNotificationDto,
  type CreateNotificationDto,
  type NotificationContent,
  type NotificationDto,
  type NotificationFiltersDto,
} from './notification.dto';

/** How many the header bell's dropdown shows. */
export const BELL_PREVIEW_COUNT = 5;

// Pushes the row plus the recipient's refreshed unread total. The count is recomputed
// and sent rather than incremented client-side: a recipient may have several tabs open
// or have been offline, and a badge derived from "+1 per event" drifts the moment one
// event is missed.
async function push(dto: NotificationDto): Promise<void> {
  const room = ROOMS.user(dto.userId);
  emitToRoom(room, REALTIME_EVENTS.NOTIFICATION_NEW, { notification: dto });
  const unread = await notificationRepository.countUnreadForUser(dto.userId);
  emitToRoom(room, REALTIME_EVENTS.NOTIFICATION_UNREAD, { unread });
}

async function emitUnread(userId: string): Promise<void> {
  const unread = await notificationRepository.countUnreadForUser(userId);
  emitToRoom(ROOMS.user(userId), REALTIME_EVENTS.NOTIFICATION_UNREAD, { unread });
}

function rowFrom(userId: string, content: NotificationContent) {
  return {
    userId,
    level: content.level ?? NotificationLevel.INFO,
    category: content.category ?? NotificationCategory.SYSTEM,
    title: content.title,
    body: content.body,
    link: content.link ?? null,
  };
}

export const notificationService = {
  async getNotifications(userId: string, filters: NotificationFiltersDto): Promise<Paginated<NotificationDto>> {
    const [rows, total] = await notificationRepository.findForUser(userId, filters);
    return paginate(rows.map(toNotificationDto), total, filters);
  },

  async getRecent(userId: string): Promise<NotificationDto[]> {
    const rows = await notificationRepository.findRecentForUser(userId, BELL_PREVIEW_COUNT);
    return rows.map(toNotificationDto);
  },

  async getUnreadCount(userId: string): Promise<{ unread: number }> {
    return { unread: await notificationRepository.countUnreadForUser(userId) };
  },

  async create(dto: CreateNotificationDto): Promise<NotificationDto> {
    const created = await notificationRepository.create(rowFrom(dto.userId, dto));
    const result = toNotificationDto(created);
    await push(result);
    return result;
  },

  // ---------------------------------------------------------------- notify layer

  async notifyUser(userId: string, content: NotificationContent): Promise<void> {
    const created = await notificationRepository.create(rowFrom(userId, content));
    await push(toNotificationDto(created));
  },

  /**
   * Every ACTIVE admin and manager, one row each.
   *
   * Fanned out rather than stored once as a broadcast so each recipient has their own
   * read state — otherwise the first admin to open a notice clears it for the team.
   */
  async notifyNetwork(content: NotificationContent): Promise<void> {
    const staff = await AppDataSource.getRepository(User).find({
      where: { role: In([UserRole.ADMIN, UserRole.MANAGER]), status: UserStatus.ACTIVE },
      select: { id: true },
    });
    if (staff.length === 0) return;

    const created = await notificationRepository.createMany(staff.map((user) => rowFrom(user.id, content)));
    await Promise.all(created.map((row) => push(toNotificationDto(row))));
  },

  async notifyAffiliate(affiliateId: string, content: NotificationContent): Promise<void> {
    const affiliate = await AppDataSource.getRepository(Affiliate).findOne({
      where: { id: affiliateId },
      select: { id: true, userId: true },
    });
    if (!affiliate) return;
    await this.notifyUser(affiliate.userId, content);
  },

  /**
   * Fire-and-forget wrapper for domain hooks.
   *
   * A notification is a side effect of a business action, never a precondition of it —
   * approving an affiliate must not fail because the notification insert did. Callers
   * use this instead of awaiting the notify helpers directly.
   */
  safeNotify(work: Promise<void>): void {
    void work.catch((err) => logger.error({ err }, 'Failed to create notification'));
  },

  // ---------------------------------------------------------------- read state

  async markRead(id: string, userId: string): Promise<NotificationDto> {
    // Scoped by owner: keyed on id alone, any authenticated user could clear anyone's
    // notification by guessing a uuid.
    const notification = await notificationRepository.findOwnedById(id, userId);
    if (!notification) {
      throw new NotFoundError('Notification not found');
    }
    if (!notification.readAt) {
      await notificationRepository.markRead(id, userId, new Date());
      await emitUnread(userId);
    }
    return toNotificationDto((await notificationRepository.findOwnedById(id, userId))!);
  },

  async markAllRead(userId: string): Promise<{ unread: number }> {
    await notificationRepository.markAllReadForUser(userId, new Date());
    await emitUnread(userId);
    return this.getUnreadCount(userId);
  },
};
