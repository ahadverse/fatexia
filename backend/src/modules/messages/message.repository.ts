import { IsNull } from 'typeorm';
import { AppDataSource } from '../../infra/database/data-source';
import { offsetOf } from '../../common/pagination';
import { Message, MessageDirection } from './message.entity';
import type { MessageFiltersDto, ThreadFiltersDto } from './message.dto';

const repository = AppDataSource.getRepository(Message);

export interface ThreadAggregateRow {
  affiliateId: string;
  lastMessageAt: string;
  messageCount: string;
  unreadCount: string;
}

export interface ThreadLatestRow {
  affiliateId: string;
  body: string;
  direction: MessageDirection;
}

export const messageRepository = {
  findAll(filters: MessageFiltersDto): Promise<[Message[], number]> {
    const qb = repository.createQueryBuilder('message');
    if (filters.affiliateId) {
      qb.andWhere('message."affiliateId" = :affiliateId', { affiliateId: filters.affiliateId });
    }
    if (filters.direction) {
      qb.andWhere('message.direction = :direction', { direction: filters.direction });
    }
    if (filters.unreadOnly) {
      qb.andWhere('message."readAt" IS NULL');
    }
    return qb
      .orderBy('message."createdAt"', 'DESC')
      .skip(offsetOf(filters))
      .take(filters.pageSize)
      .getManyAndCount();
  },

  findById(id: string): Promise<Message | null> {
    return repository.findOne({ where: { id } });
  },

  /**
   * One row per affiliate conversation, aggregated in SQL.
   *
   * The thread list used to be built by fetching a page of raw messages and grouping
   * them in JS, which silently dropped whole conversations once the network had more
   * messages than that page held. Grouping in Postgres means the list is complete
   * regardless of message volume, and paginates over *conversations* rather than
   * over messages.
   */
  threadAggregates(filters: ThreadFiltersDto): Promise<[ThreadAggregateRow[], number]> {
    const build = () => {
      const qb = repository
        .createQueryBuilder('message')
        .select('message."affiliateId"', 'affiliateId')
        .addSelect('MAX(message."createdAt")', 'lastMessageAt')
        .addSelect('COUNT(*)', 'messageCount')
        .addSelect(
          `COUNT(*) FILTER (WHERE message.direction = :inbound AND message."readAt" IS NULL)`,
          'unreadCount',
        )
        .setParameter('inbound', MessageDirection.INBOUND)
        .groupBy('message."affiliateId"');

      // Applied as HAVING, not WHERE: "threads with something unread" is a property
      // of the group, not of an individual message.
      if (filters.unreadOnly) {
        qb.having(`COUNT(*) FILTER (WHERE message.direction = :inbound AND message."readAt" IS NULL) > 0`);
      }
      return qb;
    };

    return Promise.all([
      build()
        .orderBy('MAX(message."createdAt")', 'DESC')
        .offset(offsetOf(filters))
        .limit(filters.pageSize)
        .getRawMany<ThreadAggregateRow>(),
      // getCount() would count messages, not groups, so the total comes from the
      // length of the ungrouped-but-grouped result set.
      build()
        .getRawMany()
        .then((rows) => rows.length),
    ]);
  },

  // Newest message per affiliate, for the thread-list preview. DISTINCT ON is the
  // direct way to express "one row per group, ordered within the group" in Postgres.
  latestPerThread(affiliateIds: string[]): Promise<ThreadLatestRow[]> {
    if (affiliateIds.length === 0) return Promise.resolve([]);
    return repository
      .createQueryBuilder('message')
      .distinctOn(['message."affiliateId"'])
      .select('message."affiliateId"', 'affiliateId')
      .addSelect('message.body', 'body')
      .addSelect('message.direction', 'direction')
      .where('message."affiliateId" IN (:...affiliateIds)', { affiliateIds })
      .orderBy('message."affiliateId"')
      .addOrderBy('message."createdAt"', 'DESC')
      .getRawMany<ThreadLatestRow>();
  },

  // Every message in one conversation, oldest first — the order it is read in.
  findThread(affiliateId: string): Promise<Message[]> {
    return repository.find({ where: { affiliateId }, order: { createdAt: 'ASC' } });
  },

  countUnread(direction: MessageDirection, affiliateId?: string): Promise<number> {
    return repository.count({
      where: { direction, readAt: IsNull(), ...(affiliateId ? { affiliateId } : {}) },
    });
  },

  create(data: Partial<Message>): Promise<Message> {
    return repository.save(repository.create(data));
  },

  /**
   * Marks a whole conversation read for one side of it.
   *
   * `direction` is the caller's *inbox*: the network reads INBOUND, the affiliate
   * reads OUTBOUND. Scoping the update by direction is what stops one party's read
   * receipt from clearing the other's unread state — `readAt` means "read by the
   * recipient", and the recipient is determined by direction.
   *
   * One UPDATE for the whole thread, and the `readAt IS NULL` guard keeps it
   * idempotent: re-opening a thread never rewrites timestamps that already exist.
   */
  async markThreadRead(affiliateId: string, direction: MessageDirection, readAt: Date): Promise<number> {
    const result = await repository
      .createQueryBuilder()
      .update(Message)
      .set({ readAt })
      .where('"affiliateId" = :affiliateId', { affiliateId })
      .andWhere('direction = :direction', { direction })
      .andWhere('"readAt" IS NULL')
      .execute();
    return result.affected ?? 0;
  },
};
