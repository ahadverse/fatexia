import { AppDataSource } from '../../infra/database/data-source';
import { redis } from '../../infra/redis/redis-client';
import { logger } from '../../common/logger';
import { Click } from './click.entity';

/**
 * Whether a click is the first for its offer from this IP inside the dedup window.
 *
 * Scope is **offer + IP over 24 hours** — deliberately not per-affiliate. Two
 * affiliates sending the same visitor to the same offer is one person seeing one
 * offer, and counting it twice is exactly what the unique metric exists to avoid.
 *
 * Decided at write time and stored on the row, rather than derived at read time with a
 * window function, for two reasons: the click log needs a per-row Yes/No that can be
 * filtered and sorted, and the aggregate `uniqueClicks` in reports must agree with that
 * badge. One stored boolean gives both a single definition.
 */

const WINDOW_SECONDS = 24 * 60 * 60;

export async function isFirstClick(offerId: string, ip: string): Promise<boolean> {
  // SET NX EX is atomic — two simultaneous clicks from one IP cannot both win, which a
  // read-then-write would allow.
  try {
    const result = await redis.set(`uniq:${offerId}:${ip}`, '1', 'EX', WINDOW_SECONDS, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn({ err, offerId }, 'Redis unique-click check failed, falling back to Postgres');
  }

  // Redis down: one indexed lookup on (offerId, ip, createdAt). Slower, but a click
  // must never be lost because a cache is unavailable.
  try {
    const since = new Date(Date.now() - WINDOW_SECONDS * 1000);
    const existing = await AppDataSource.getRepository(Click)
      .createQueryBuilder('click')
      .where('click."offerId" = :offerId', { offerId })
      .andWhere('click.ip = :ip', { ip })
      .andWhere('click."createdAt" >= :since', { since })
      .limit(1)
      .getExists();
    return !existing;
  } catch (err) {
    // Both stores unreachable. Counting it as unique overstates the metric slightly;
    // the alternative understates traffic the affiliate genuinely sent, which is the
    // worse error when the number feeds a payout conversation.
    logger.error({ err, offerId }, 'Unique-click check failed entirely, defaulting to unique');
    return true;
  }
}
