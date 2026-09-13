import { AppDataSource } from '../../infra/database/data-source';
import { logger } from '../../common/logger';

/**
 * Hands out the short numeric click ids, without a database round trip per click.
 *
 * A click's id goes straight into the redirect URL and is handed to the visitor before
 * the click row is even written (the insert in click.service.ts is deliberately
 * fire-and-forget). So the id cannot come from `nextval` at click time: that would put
 * a database round trip in front of every redirect, on the one path in this system
 * where latency is visible to a stranger who never asked to be here.
 *
 * Instead the sequence increments by BLOCK_SIZE, so a single `nextval` reserves a whole
 * block that this process then hands out from memory. One round trip per BLOCK_SIZE
 * clicks, and it happens ahead of time — the refill fires while there are still ids
 * left, so the common path never waits.
 *
 * Consequences worth being explicit about:
 *
 * - Ids ascend but are not gapless. A restart abandons whatever is left of the current
 *   block. That is fine: this is an identifier, not a count of anything, and the
 *   reports derive volume from rows, never from id arithmetic.
 * - Two processes (the API and the Tracker run separately) each hold their own block,
 *   so ids interleave rather than running strictly in time order. They stay unique,
 *   which is the only property anything depends on.
 */
const BLOCK_SIZE = 500;

// Refill once a fifth of the block is left, so the round trip overlaps with traffic
// still being served from the tail of the current one.
const REFILL_AT = Math.floor(BLOCK_SIZE / 5);

let next = 0;
let remaining = 0;
let refill: Promise<void> | null = null;

async function reserveBlock(): Promise<void> {
  const rows: { value: string }[] = await AppDataSource.query(`SELECT nextval('clicks_ref_id_seq') AS value`);
  // The sequence's own increment is BLOCK_SIZE, so the value it returns is the first id
  // of a block that nothing else will be given.
  next = Number(rows[0]!.value);
  remaining = BLOCK_SIZE;
}

function startRefill(): Promise<void> {
  if (refill) return refill;
  refill = reserveBlock()
    .catch((err) => {
      logger.error({ err }, 'Failed to reserve a click id block');
      throw err;
    })
    .finally(() => {
      refill = null;
    });
  return refill;
}

/**
 * The next click id. Awaits a refill only when the block is genuinely exhausted —
 * which, outside the first click after a restart, means the prefetch below failed.
 */
export async function nextClickRefId(): Promise<number> {
  if (remaining === 0) {
    await startRefill();
  } else if (remaining <= REFILL_AT && !refill) {
    // Deliberately not awaited: the current block still has ids, and making this click
    // wait for the next one would defeat the point of prefetching. A failure is logged
    // by startRefill and retried on the click after it.
    void startRefill().catch(() => undefined);
  }

  remaining -= 1;
  return next++;
}

/** Test seam — drops any reserved block so a suite can start from a known state. */
export function resetClickRefIdBlock(): void {
  next = 0;
  remaining = 0;
  refill = null;
}
