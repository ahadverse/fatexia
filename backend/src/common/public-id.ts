import type { EntityManager } from 'typeorm';
import { AppDataSource } from '../infra/database/data-source';

/**
 * Issue #21 — the professional, sequential account ids (`AFF-1001`, `MAN-1042`).
 *
 * Backed by dedicated Postgres sequences, created in
 * ManagerAccessAndPublicIds1786400000000. `nextval` is the only safe way to do this:
 * `SELECT MAX(...) + 1` under two concurrent registrations reads the same maximum
 * twice and mints a duplicate, which the unique index would then reject — turning a
 * cosmetic id into a failed signup.
 *
 * A sequence never reuses a number, not even after a rollback. That leaves occasional
 * gaps (a registration that failed after taking an id), which is the correct trade:
 * these ids are quoted in support threads and payout references, so "never reused" is
 * worth more than "no gaps".
 */
const SEQUENCES = {
  AFF: 'affiliate_public_id_seq',
  MAN: 'manager_public_id_seq',
} as const;

export type PublicIdPrefix = keyof typeof SEQUENCES;

interface NextvalRow {
  nextval: string;
}

/**
 * Takes the next id for `prefix`. Pass the transaction's `EntityManager` when minting
 * inside one — sequences are non-transactional by design, so this is about running on
 * the same connection, not about rolling the number back.
 */
export async function nextPublicId(prefix: PublicIdPrefix, manager?: EntityManager): Promise<string> {
  const runner = manager ?? AppDataSource.manager;
  const rows = await runner.query<NextvalRow[]>(`SELECT nextval('${SEQUENCES[prefix]}') AS nextval`);
  return `${prefix}-${rows[0]!.nextval}`;
}
