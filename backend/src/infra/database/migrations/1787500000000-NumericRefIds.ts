import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Short numeric reference ids for the things people quote at each other.
 *
 * Every row in this system is keyed by a uuid, which is right for a primary key and
 * useless for a human: nobody reads "cc92887b-faea-5500-90e2-f7a001467e3f" down the
 * phone, pastes it into a chat with their manager, or spots it twice in a log. Every
 * network an affiliate has worked on gives them a counter instead — offer 123645, click
 * 258963 — so this adds one alongside the uuid rather than replacing it.
 *
 * Affiliates are deliberately not in the list: they already have `publicId` (`AFF-1001`
 * upward, migration 1786400000000), which staff search by and both portals display. A
 * second counter for the same row would only create the question of which one to quote.
 *
 * `refId` is a display and lookup key, never a foreign key. The uuid stays the primary
 * key and every existing relation keeps pointing at it, so this migration adds columns
 * and touches nothing that already works.
 *
 * Each table gets its own sequence, started somewhere that looks like a network with
 * history rather than one that opened this morning, and backfilled in creation order so
 * the oldest row has the lowest number.
 *
 * The clicks sequence increments by 500 on purpose. A click's id is minted in-process
 * and put straight into the redirect URL before the row is even written (see
 * click.service.ts), so it cannot wait on a round trip to the database; the tracker
 * draws one block of 500 at a time and hands them out locally. That means a restart
 * abandons the unused tail of a block, so click refIds ascend with occasional gaps —
 * which is what the id is for. Uniqueness is what matters and the sequence guarantees
 * it.
 */

interface Target {
  table: string;
  sequence: string;
  start: number;
  increment: number;
}

const TARGETS: Target[] = [
  { table: 'offers', sequence: 'offers_ref_id_seq', start: 100_000, increment: 1 },
  { table: 'clicks', sequence: 'clicks_ref_id_seq', start: 200_000, increment: 500 },
  { table: 'conversions', sequence: 'conversions_ref_id_seq', start: 300_000, increment: 1 },
];

export class NumericRefIds1787500000000 implements MigrationInterface {
  name = 'NumericRefIds1787500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    for (const { table, sequence, start, increment } of TARGETS) {
      await queryRunner.query(`CREATE SEQUENCE "${sequence}" START WITH ${start} INCREMENT BY ${increment}`);
      await queryRunner.query(`ALTER TABLE "${table}" ADD "refId" bigint`);

      // Backfilled through a numbered subquery rather than a bare `nextval` per row:
      // an UPDATE has no defined row order, so this is the only way the oldest row
      // reliably gets the lowest number.
      //
      // Counted one at a time even where the sequence steps by 500. The block size is
      // about how ids are handed out to a running tracker, not about how they are
      // written down — numbering history in steps of 500 would leave every existing
      // click sitting on a round number with 499 unexplained gaps after it.
      await queryRunner.query(`
        UPDATE "${table}" AS t
           SET "refId" = ${start} + ordered.position - 1
          FROM (
            SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS position
              FROM "${table}"
          ) AS ordered
         WHERE t.id = ordered.id
      `);

      // Move the sequence past whatever the backfill consumed, so the next insert
      // cannot collide with a row that already exists.
      await queryRunner.query(`
        SELECT setval('${sequence}', GREATEST(${start}, COALESCE((SELECT MAX("refId") FROM "${table}"), 0) + ${increment}), false)
      `);

      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "refId" SET NOT NULL`);
      await queryRunner.query(`ALTER TABLE "${table}" ALTER COLUMN "refId" SET DEFAULT nextval('${sequence}')`);
      // Unique because it is quoted as an identifier — two offers sharing a number
      // would make every conversation about "offer 100042" ambiguous.
      await queryRunner.query(`CREATE UNIQUE INDEX "UQ_${table}_refId" ON "${table}" ("refId")`);
      // Tie the sequence's lifetime to the column, so a later DROP COLUMN cleans up.
      await queryRunner.query(`ALTER SEQUENCE "${sequence}" OWNED BY "${table}"."refId"`);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const { table, sequence } of [...TARGETS].reverse()) {
      await queryRunner.query(`DROP INDEX "public"."UQ_${table}_refId"`);
      await queryRunner.query(`ALTER TABLE "${table}" DROP COLUMN "refId"`);
      // Owned by the column, so it is already gone; guarded for a partially applied run.
      await queryRunner.query(`DROP SEQUENCE IF EXISTS "${sequence}"`);
    }
  }
}
