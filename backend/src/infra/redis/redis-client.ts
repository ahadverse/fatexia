import Redis from 'ioredis';
import { env } from '../../common/env';
import { logger } from '../../common/logger';

// Shared client for both processes (see PLAN-tracker.md Step 4/5: proxy-detection
// cache + per-provider quota counters; later BullMQ queues per PLAN-backend.md).
// `lazyConnect` off — ioredis connects immediately and queues commands while
// reconnecting, which is what the fail-open callers here rely on.
export const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: 1,
  retryStrategy: (times) => Math.min(times * 200, 2000),
});

redis.on('error', (err) => {
  logger.warn({ err }, 'Redis connection error');
});

redis.on('connect', () => {
  logger.info('Redis connected');
});
