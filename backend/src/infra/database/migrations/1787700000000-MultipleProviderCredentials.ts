import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Lets one provider hold several credentials, tried in order.
 *
 * `integrations.provider` was unique, so IPHub meant exactly one API key. The free
 * tiers these providers hand out are metered per key — IPHub allows 1000 lookups a day
 * — and a network sending more clicks than that had nowhere to go but the next
 * provider down the cascade, which is a worse signal, or nothing at all.
 *
 * Dropping the constraint turns the cascade from "IPHub → ipapi.is → IPQS" into
 * "every IPHub key in order → every ipapi.is key in order → …", so buying quota is a
 * matter of pasting another key rather than changing code. `position` is the order
 * they are tried in, and the order the Admin page lists them.
 *
 * Quota counters move with this: they were keyed by provider name, which would have
 * made several keys share one 1000/day budget and defeat the entire point. They are
 * keyed by integration id now (see fraud/proxy-detection.ts).
 */
export class MultipleProviderCredentials1787700000000 implements MigrationInterface {
  name = 'MultipleProviderCredentials1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Named constraint from the table's original migration (1785400000000).
    await queryRunner.query(`ALTER TABLE "integrations" DROP CONSTRAINT "UQ_5297e5d1d49d1831c86a609fe3f"`);
    await queryRunner.query(`ALTER TABLE "integrations" ADD "position" integer NOT NULL DEFAULT 0`);
    // Not unique, and deliberately so: two rows sharing a position is a tie the ordering
    // breaks by id, not a state worth rejecting a save over.
    await queryRunner.query(`CREATE INDEX "IDX_integrations_provider_position" ON "integrations" ("provider", "position")`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_integrations_provider_position"`);
    await queryRunner.query(`ALTER TABLE "integrations" DROP COLUMN "position"`);
    // Restoring the constraint requires the table to hold one row per provider again.
    // Extra credentials are deleted oldest-kept-first rather than failing the rollback.
    await queryRunner.query(`
      DELETE FROM "integrations" a
       USING "integrations" b
       WHERE a.provider = b.provider
         AND a."createdAt" > b."createdAt"
    `);
    await queryRunner.query(
      `ALTER TABLE "integrations" ADD CONSTRAINT "UQ_5297e5d1d49d1831c86a609fe3f" UNIQUE ("provider")`,
    );
  }
}
