import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { Notification } from './notification.entity';
import type { NotificationFiltersDto } from './notification.dto';

const repository = AppDataSource.getRepository(Notification);

/**
 * Every query here is scoped strictly to one `userId`.
 *
 * The previous version matched `("userId" = :userId OR "userId" IS NULL)` so that a
 * null-userId row acted as a broadcast. Two things followed from that, both wrong:
 * an affiliate calling GET /notifications received the network's internal notices
 * ("2 affiliate applications pending review"), and one reader's acknowledgement of a
 * broadcast marked it read for everyone, because there was a single shared `readAt`.
 *
 * Notifications are now fanned out at write time — one row per recipient — so audience
 * and read state are both properties of the row rather than of the query.
 */
export const notificationRepository = {
  findForUser(userId: string, filters: NotificationFiltersDto): Promise<[Notification[], number]> {
    const qb = repository.createQueryBuilder('notification').where('notification."userId" = :userId', { userId });

    if (filters.category) {
      qb.andWhere('notification.category = :category', { category: filters.category });
    }
    if (filters.level) {
      qb.andWhere('notification.level = :level', { level: filters.level });
    }
    if (filters.unreadOnly) {
      qb.andWhere('notification."readAt" IS NULL');
    }
    return qb
      .orderBy('notification."createdAt"', 'DESC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  countUnreadForUser(userId: string): Promise<number> {
    return repository
      .createQueryBuilder('notification')
      .where('notification."userId" = :userId', { userId })
      .andWhere('notification."readAt" IS NULL')
      .getCount();
  },

  /** Newest few, for the header bell's dropdown. */
  findRecentForUser(userId: string, limit: number): Promise<Notification[]> {
    return repository.find({ where: { userId }, order: { createdAt: 'DESC' }, take: limit });
  },

  findById(id: string): Promise<Notification | null> {
    return repository.findOne({ where: { id } });
  },

  /** Scoped by owner as well as id — without this, any authenticated user could mark
   *  any notification read just by knowing its uuid. */
  findOwnedById(id: string, userId: string): Promise<Notification | null> {
    return repository.findOne({ where: { id, userId } });
  },

  create(data: Partial<Notification>): Promise<Notification> {
    return repository.save(repository.create(data));
  },

  // One insert for a fan-out, rather than one round-trip per recipient.
  createMany(rows: Partial<Notification>[]): Promise<Notification[]> {
    return repository.save(rows.map((row) => repository.create(row)));
  },

  async markRead(id: string, userId: string, readAt: Date): Promise<void> {
    await repository.update({ id, userId }, { readAt });
  },

  async markAllReadForUser(userId: string, readAt: Date): Promise<void> {
    await repository
      .createQueryBuilder()
      .update(Notification)
      .set({ readAt })
      .where('"userId" = :userId', { userId })
      .andWhere('"readAt" IS NULL')
      .execute();
  },
};
